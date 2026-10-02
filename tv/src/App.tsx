// Everybody Moves for Fire TV: one family workout where each person gets their own version of
// every move. The TV runs the session; phones check in by QR code; the service plans the
// session from the household's history and today's check-ins.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Text, View} from 'react-native';
import {BackHandler, useTVEventHandler} from '@amazon-devices/react-native-kepler';
import {api, Block, HouseholdView, Member, position, Rating, Session, Summary} from './api';
import * as voice from './voice';
import {C, FocusButton, s, u} from './ui/kit';
import {Home} from './screens/Home';
import {Lobby} from './screens/Lobby';
import {PlanScreen} from './screens/PlanScreen';
import {Workout} from './screens/Workout';
import {Rate, SummaryScreen} from './screens/Rate';

type Screen = 'loading' | 'home' | 'lobby' | 'plan' | 'workout' | 'rate' | 'summary' | 'error';

// What the coach says when a block starts. Only people whose version differs from the most
// common one are named, so the line stays short.
export function cueFor(b: Block, next: Block | undefined, people: Member[]): string {
  if (b.kind === 'rest') return `Rest. Next up, ${b.move.toLowerCase()}.`;
  const counts = new Map<string, number>();
  for (const v of b.per_member) counts.set(v.name, (counts.get(v.name) ?? 0) + 1);
  const common = [...counts.entries()].sort((a, c) => c[1] - a[1])[0]?.[0];
  const callouts = b.per_member
    .filter(v => v.name !== common)
    .map(v => `${people.find(m => m.id === v.member_id)?.name ?? ''}, ${v.name.toLowerCase()}`)
    .slice(0, 3);
  const head = b.kind === 'warmup' ? `Warm-up. ${b.move}.` : b.kind === 'cooldown' ? `Cool-down. ${b.move}. Breathe out slowly.` : `${b.move}!`;
  return [head, ...callouts.map(c => c + '.')].join(' ');
}

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
      } catch {}
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

  // Move between screens as the session advances.
  useEffect(() => {
    if (screen === 'workout' && pos?.done) {
      setScreen('rate');
      voice.say("That's the last one. Great work, everyone. How did it feel?");
    }
  }, [screen, pos?.done]);

  // Speak each block's cue once, when it starts.
  useEffect(() => {
    if (screen !== 'workout' || !session?.plan || !pos || pos.done) return;
    const key = `${session.code}:${pos.index}`;
    if (spokenFor.current === key) return;
    spokenFor.current = key;
    const people = session.members;
    voice.say(cueFor(session.plan.blocks[pos.index], session.plan.blocks[pos.index + 1], people));
  }, [screen, session, pos?.index, pos?.done]);

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
      setError(String(e?.message ?? e));
    }
  };

  const toggle = async (m: Member, present: boolean) => {
    if (!code) return;
    await api.present(code, m.id, present).catch(() => {});
    setSession(await api.session(code));
  };

  const makePlan = async () => {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const s2 = await api.plan(code, demoPace);
      setSession(s2);
      setScreen('plan');
      const people = s2.members;
      voice.prefetch(s2.plan!.blocks.map((b, i) => cueFor(b, s2.plan!.blocks[i + 1], people)));
      if (s2.coach) voice.say(s2.coach.text);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
    setBusy(false);
  };

  const control = async (a: 'start' | 'pause' | 'resume' | 'next' | 'prev' | 'end') => {
    if (!code) return;
    if (a === 'end') {
      voice.stop();
      setScreen('rate');
      return;
    }
    if (a === 'start') {
      voice.stop();
      spokenFor.current = '';
    }
    await api.control(code, a).catch(() => {});
    const s2 = await api.session(code);
    setSession(s2);
    if (a === 'start') setScreen('workout');
  };

  const rate = async (member: string, r: Rating) => {
    if (!code) return;
    await api.rate(code, member, r).catch(() => {});
    setSession(await api.session(code));
  };

  const finish = async () => {
    if (!code || !hid) return;
    setBusy(true);
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

  // Remote: play/pause pauses the session, fast-forward and rewind skip blocks.
  useTVEventHandler((evt: any) => {
    if (screen !== 'workout' || evt?.eventKeyAction !== 1) return;
    if (evt.eventType === 'playpause') control(session?.timing.paused_at ? 'resume' : 'pause');
    else if (evt.eventType === 'forward') control('next');
    else if (evt.eventType === 'rewind') control('prev');
  });

  // Back: step out of the current screen instead of leaving the app mid-session.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'lobby' || screen === 'summary') {
        setScreen('home');
        return true;
      }
      if (screen === 'plan') {
        setScreen('lobby');
        return true;
      }
      if (screen === 'workout') {
        control(session?.timing.paused_at ? 'resume' : 'pause');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  });

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
    return <Home h={house} t={t} onStart={startSession} onReset={boot} />;
  if (screen === 'lobby' && session)
    return <Lobby session={session} joinUrl={joinUrl} demoPace={demoPace} onTogglePace={() => setDemoPace(!demoPace)} onToggle={toggle} onPlan={makePlan} busy={busy} error={error} />;
  if (screen === 'plan' && session?.plan)
    return <PlanScreen session={session} t={t} onStart={() => control('start')} onBack={() => setScreen('lobby')} />;
  if (screen === 'workout' && session?.plan)
    return <Workout session={session} index={pos?.index ?? 0} remaining={pos?.remaining ?? session.plan.blocks[0].seconds} t={t} onControl={control} coachLine={coachLine} />;
  if (screen === 'rate' && session) return <Rate session={session} onRate={rate} onFinish={finish} busy={busy} />;
  if (screen === 'summary' && summary) return <SummaryScreen summary={summary} onHome={() => setScreen('home')} />;
  return <View style={s.screen} />;
};
