// Everybody Moves for Fire TV: one family workout where each person gets their own version of
// every move. The TV runs the session; phones check in by QR code; the service plans the
// session from the household's history and today's check-ins.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Text, View} from 'react-native';
import {BackHandler, useTVEventHandler} from '@amazon-devices/react-native-kepler';
import {api, HouseholdView, Member, position, Rating, Session, Summary} from './api';
import * as voice from './voice';
import {cueFor, sentences} from './cues';
import {C, FocusButton, s, u} from './ui/kit';
import {Home} from './screens/Home';
import {Lobby} from './screens/Lobby';
import {PlanScreen} from './screens/PlanScreen';
import {Workout} from './screens/Workout';
import {Rate, SummaryScreen} from './screens/Rate';

type Screen = 'loading' | 'home' | 'lobby' | 'plan' | 'workout' | 'rate' | 'summary' | 'error';

export const App = () => {
  const [screen, setScreen] = useState<Screen>('loading');
  const [hid, setHid] = useState<string | null>(null);
  const [house, setHouse] = useState<HouseholdView | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [demoPace, setDemoPace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [coachLine, setCoachLine] = useState<string | null>(null);
  const skew = useRef(0);
  const spokenFor = useRef<string>('');

  // Animation clock (about 20 frames a second is plenty for the stick figures).
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setT((Date.now() - start) / 1000), 50);
    return () => clearInterval(id);
  }, []);
  useEffect(() => voice.onLine(setCoachLine), []);
  const codeRef = useRef<string | null>(null);
  codeRef.current = code;
  useEffect(() => voice.setRoom(code), [code]);
  useEffect(() => voice.onSaid(line => codeRef.current && api.said(codeRef.current, line).catch(() => {})), []);

  const loadHousehold = useCallback(async (id: string) => {
    setHouse(await api.household(id));
  }, []);

  const boot = useCallback(async () => {
    setScreen('loading');
    try {
      const d = await api.demo();
      setHid(d.hid);
      await loadHousehold(d.hid);
      setScreen('home');
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setScreen('error');
    }
  }, [loadHousehold]);

  useEffect(() => {
    boot();
  }, [boot]);

  // While a session is open, read it every second; the server's clock is the source of truth.
  useEffect(() => {
    if (!code || screen === 'home' || screen === 'summary') return;
    let alive = true;
    const tick = async () => {
      try {
        const t0 = Date.now();
        const s = await api.session(code);
        skew.current = s.server_now - Math.round((t0 + Date.now()) / 2);
        if (alive) setSession(s);
      } catch {
        // Keep showing the last state; the next tick tries again.
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [code, screen]);

  const now = Date.now() + skew.current;
  const pos = session?.plan && session.timing.started_at ? position(session.plan, session.timing, now) : null;

  const blockIndex = pos?.index ?? -1;
  const over = !!pos?.done;
  const endedEarly = !!session?.timing.ended_at;

  // Move between screens as the session advances (the clock ran out, or End was pressed).
  useEffect(() => {
    if (screen === 'workout' && over) {
      setScreen('rate');
      voice.say(endedEarly ? "Let's stop there. Good work, everyone. How did it feel?" : "That's the last one. Great work, everyone. How did it feel?");
    }
  }, [screen, over, endedEarly]);

  // Speak each block's cue once, when it starts.
  useEffect(() => {
    if (screen !== 'workout' || !session?.plan || blockIndex < 0 || over) return;
    const key = `${session.code}:${blockIndex}`;
    if (spokenFor.current === key) return;
    spokenFor.current = key;
    voice.say(cueFor(session.plan.blocks[blockIndex], session.plan.blocks[blockIndex + 1], session.members));
  }, [screen, session, blockIndex, over]);

  const startSession = async () => {
    if (!hid) return;
    setError(null);
    try {
      const r = await api.newSession(hid);
      setCode(r.code);
      setJoinUrl(r.join_url);
      setSession(await api.session(r.code));
      setScreen('lobby');
    } catch (e: any) {
      setError(`Couldn't open a room: ${String(e?.message ?? e)}`);
    }
  };

  const toggle = async (m: Member, present: boolean) => {
    if (!code) return;
    setError(null);
    try {
      await api.present(code, m.id, present);
      setSession(await api.session(code));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  };

  const makePlan = async () => {
    if (!code) return;
    if (!session?.presence.some(p => p.present)) {
      setError('Add at least one person first: select a name and press OK, or scan the code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s2 = await api.plan(code, demoPace);
      setSession(s2);
      setScreen('plan');
      const people = s2.members;
      voice.prefetch(s2.plan!.blocks.map((b, i) => cueFor(b, s2.plan!.blocks[i + 1], people)));
      if (s2.coach) voice.sayAll(sentences(s2.coach.text));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
    setBusy(false);
  };

  const control = async (a: 'start' | 'pause' | 'resume' | 'next' | 'prev' | 'end') => {
    if (!code) return;
    if (a === 'end' || a === 'start') voice.stop();
    if (a === 'start') spokenFor.current = '';
    try {
      await api.control(code, a);
      setSession(await api.session(code));
      if (a === 'start') setScreen('workout');
    } catch {
      // The once-a-second refresh shows the real state; a missed press can simply be repeated.
    }
  };

  const rate = async (member: string, r: Rating) => {
    if (!code) return;
    try {
      await api.rate(code, member, r);
      setSession(await api.session(code));
    } catch {
      // Shown on the next refresh, or the press can be repeated.
    }
  };

  const finish = async () => {
    if (!code || !hid) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.finish(code);
      setSummary(r.summary);
      setScreen('summary');
      voice.say(r.summary.changes[0] ? r.summary.changes[0][0].toUpperCase() + r.summary.changes[0].slice(1) + '.' : 'Same levels next time. See you tomorrow.');
      await loadHousehold(hid);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
    setBusy(false);
  };

  // The remote handlers read the latest state through a ref, so they are registered once
  // (re-registering on every animation frame could drop presses).
  const live = useRef({screen, session, control});
  live.current = {screen, session, control};

  // Remote: play/pause pauses the session, fast-forward and rewind skip blocks. On the Vega
  // Virtual Device those keys arrive as 'forward' and 'rewind' (the HWEvent type lists
  // 'skip_forward' / 'skip_backward'), so both spellings are accepted.
  const onRemote = useCallback((evt: any) => {
    const {screen: sc, session: se, control: ctl} = live.current;
    if (sc !== 'workout' || evt?.eventKeyAction !== 1) return;
    const k = String(evt.eventType);
    if (k === 'playpause' || k === 'pause' || k === 'play') ctl(se?.timing.paused_at ? 'resume' : 'pause');
    else if (k === 'skip_forward' || k === 'forward' || k === 'fast_forward') ctl('next');
    else if (k === 'skip_backward' || k === 'rewind') ctl('prev');
  }, []);
  useTVEventHandler(onRemote);

  // Back: step out of the current screen instead of leaving the app mid-session.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const {screen: sc, session: se, control: ctl} = live.current;
      if (sc === 'lobby' || sc === 'summary') {
        setScreen('home');
        return true;
      }
      if (sc === 'plan') {
        setScreen('lobby');
        return true;
      }
      if (sc === 'workout') {
        ctl(se?.timing.paused_at ? 'resume' : 'pause');
        return true;
      }
      // Ratings decide next time's levels: back doesn't skip them.
      if (sc === 'rate') return true;
      return false;
    });
    return () => sub.remove();
  }, []);

  if (screen === 'loading')
    return (
      <View style={[s.screen, {justifyContent: 'center', alignItems: 'center'}]}>
        <Text style={s.kicker}>Everybody Moves</Text>
        <Text style={[s.dim, {marginTop: u(12)}]}>Getting your household ready…</Text>
      </View>
    );
  if (screen === 'error')
    return (
      <View style={[s.screen, {justifyContent: 'center'}]}>
        <Text style={s.h1}>Can't reach the coach</Text>
        <Text style={[s.dim, {marginTop: u(12), color: C.red}]}>{error}</Text>
        <View style={{flexDirection: 'row', marginTop: u(30)}}>
          <FocusButton label="Try again" preferred onPress={boot} />
        </View>
      </View>
    );
  if (screen === 'home' && house)
    return <Home h={house} t={t} onStart={startSession} onReset={boot} error={error} />;
  if (screen === 'lobby' && session)
    return <Lobby session={session} joinUrl={joinUrl} demoPace={demoPace} onTogglePace={() => setDemoPace(!demoPace)} onToggle={toggle} onPlan={makePlan} busy={busy} error={error} />;
  if (screen === 'plan' && session?.plan)
    return <PlanScreen session={session} t={t} onStart={() => control('start')} onBack={() => setScreen('lobby')} />;
  if (screen === 'workout' && session?.plan)
    return <Workout session={session} index={pos?.index ?? 0} remaining={pos?.remaining ?? session.plan.blocks[0].seconds} t={t} onControl={control} coachLine={coachLine} />;
  if (screen === 'rate' && session) return <Rate session={session} onRate={rate} onFinish={finish} busy={busy} error={error} />;
  if (screen === 'summary' && summary) return <SummaryScreen summary={summary} onHome={() => setScreen('home')} />;
  return <View style={s.screen} />;
};
