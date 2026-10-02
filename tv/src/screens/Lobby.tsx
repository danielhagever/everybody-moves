import React, {useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {Member, Presence, Session, LEVEL_NAMES} from '../api';
import {Avatar, C, FocusButton, QR, Tag, s, u} from '../ui/kit';

const ENERGY = ['', 'Wiped', 'Low', 'OK', 'Good', 'Great'];

function MemberCard({m, p, onToggle, preferred}: {m: Member; p?: Presence; onToggle: () => void; preferred?: boolean}) {
  const [focused, setFocused] = useState(false);
  const inRoom = !!p?.present;
  let status = 'Not here';
  if (inRoom && p?.energy != null) status = `Checked in${p.via === 'phone' ? ' on phone' : ''}`;
  else if (inRoom) status = p?.via === 'phone' ? 'Joined on phone' : 'Here, no check-in';
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      onPress={onToggle}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        flexDirection: 'row', alignItems: 'center', padding: u(20), marginBottom: u(16), borderRadius: u(24),
        backgroundColor: inRoom ? C.panel2 : C.panel, borderWidth: u(4),
        borderColor: focused ? C.amber : inRoom ? m.color : 'transparent',
        opacity: inRoom || focused ? 1 : 0.6,
        transform: [{scale: focused ? 1.03 : 1}],
      }}>
      <Avatar name={m.name} color={m.color} size={u(72)} />
      <View style={{marginLeft: u(22), flex: 1}}>
        <Text style={[s.body, {fontWeight: '800', fontSize: u(32)}]}>{m.name}</Text>
        <Text style={[s.dim, {fontSize: u(22)}]}>Level {m.level} · {LEVEL_NAMES[m.level]}{m.low_impact ? ' · no jumping' : ''}</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
          <Tag text={status} color={inRoom ? (p?.energy != null ? C.green : C.amber) : C.faint} />
          {p?.energy != null ? <Tag text={`Energy: ${ENERGY[p.energy]}`} color={p.energy <= 2 ? C.amber : C.dim} /> : null}
          {(p?.sore ?? []).map(x => <Tag key={x} text={`Sore ${x}`} color={C.red} />)}
        </View>
      </View>
      <Text style={[s.dim, {fontSize: u(22)}]}>{inRoom ? 'OK to remove' : 'OK to add'}</Text>
    </Pressable>
  );
}

export function Lobby({session, joinUrl, demoPace, onTogglePace, onToggle, onPlan, busy, error}: {
  session: Session; joinUrl: string; demoPace: boolean; onTogglePace: () => void; onToggle: (m: Member, present: boolean) => void; onPlan: () => void; busy: boolean; error: string | null;
}) {
  const inRoom = session.presence.filter(p => p.present).length;
  return (
    <View style={[s.screen, {flexDirection: 'row'}]}>
      <View style={{width: u(560), marginRight: u(64)}}>
        <Text style={s.kicker}>Room {session.code}</Text>
        <Text style={s.h1}>Who's working out?</Text>
        <Text style={[s.dim, {marginTop: u(12)}]}>Scan to check in from your phone. Your energy and anything sore stay between you and the coach.</Text>
        <View style={{marginTop: u(30), alignSelf: 'flex-start'}}>
          <QR value={joinUrl} size={u(300)} />
        </View>
        <Text style={[s.dim, {marginTop: u(18), fontSize: u(22)}]}>{joinUrl.replace('https://', '')}</Text>
      </View>
      <View style={{flex: 1}}>
        {session.members.map((m, i) => (
          <MemberCard key={m.id} m={m} p={session.presence.find(p => p.member_id === m.id)} preferred={i === 0} onToggle={() => onToggle(m, !session.presence.find(p => p.member_id === m.id)?.present)} />
        ))}
        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: u(18)}}>
          <FocusButton
            testID="build-plan"
            label={busy ? 'The coach is planning…' : `Build our plan (${inRoom} ${inRoom === 1 ? 'person' : 'people'})`}
            tone="primary"
            onPress={() => !busy && inRoom > 0 && onPlan()}
          />
          <FocusButton testID="pace" label={demoPace ? 'Pace: demo (5x)' : 'Pace: real time'} small tone="quiet" onPress={onTogglePace} style={{marginLeft: u(24)}} />
        </View>
        {error ? <Text style={[s.dim, {color: C.red, marginTop: u(12)}]}>{error}</Text> : null}
      </View>
    </View>
  );
}
