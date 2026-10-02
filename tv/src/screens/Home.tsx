import React from 'react';
import {Text, View} from 'react-native';
import {HouseholdView, LEVEL_NAMES} from '../api';
import {Avatar, C, FocusButton, s, u} from '../ui/kit';
import {Figure} from '../ui/Figure';

export function Home({h, t, onStart, onReset}: {h: HouseholdView; t: number; onStart: () => void; onReset: () => void}) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();
  // Last 7 days, oldest first: did the household work out that day?
  const week = Array.from({length: 7}, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 86_400_000);
    const done = h.recent.some(r => new Date(r.started_at).toDateString() === d.toDateString());
    return {label: days[d.getDay()], done, isToday: i === 6};
  });
  return (
    <View style={[s.screen, {flexDirection: 'row'}]}>
      <View style={{flex: 1.35, paddingRight: u(56)}}>
        <Text style={s.kicker}>Everybody Moves</Text>
        <Text style={[s.h1, {fontSize: u(76)}]}>One workout.{'\n'}Everyone's own version.</Text>
        <Text style={[s.dim, {marginTop: u(18), maxWidth: u(820)}]}>
          Check in from your phone, and the coach gives each person the right version of every move, from Grandpa's chair squat to Lily's jump squat.
        </Text>
        <View style={{flexDirection: 'row', marginTop: u(44), alignItems: 'center'}}>
          <FocusButton testID="start" label="Start today's workout" sub={`${h.household.name}`} tone="primary" preferred onPress={onStart} style={{paddingHorizontal: u(56)}} />
          <FocusButton testID="reset" label="New sample household" tone="quiet" small onPress={onReset} style={{marginLeft: u(28)}} />
        </View>
        <View style={{flexDirection: 'row', marginTop: u(52)}}>
          {h.members.map(m => (
            <View key={m.id} style={{alignItems: 'center', marginRight: u(40)}}>
              <Avatar name={m.name} color={m.color} size={u(84)} />
              <Text style={[s.body, {fontWeight: '800', marginTop: u(12)}]}>{m.name}</Text>
              <Text style={[s.dim, {fontSize: u(22)}]}>
                Level {m.level} · {LEVEL_NAMES[m.level]}
                {m.low_impact ? ' · no jumping' : ''}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{flex: 1}}>
        <View style={[s.panel, {alignItems: 'center'}]}>
          <Figure anim="jacks" t={t} size={u(260)} color={C.amber} />
        </View>
        <View style={[s.panel, {marginTop: u(24)}]}>
          <Text style={[s.kicker, {color: C.dim, fontSize: u(20)}]}>This week</Text>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: u(16)}}>
            {week.map((d, i) => (
              <View key={i} style={{alignItems: 'center'}}>
                <View style={{width: u(46), height: u(46), borderRadius: u(23), backgroundColor: d.done ? C.green : 'transparent', borderWidth: u(3), borderColor: d.isToday ? C.amber : d.done ? C.green : C.line}} />
                <Text style={[s.dim, {fontSize: u(20), marginTop: u(6)}]}>{d.label}</Text>
              </View>
            ))}
          </View>
          <Text style={[s.dim, {marginTop: u(14), fontSize: u(22)}]}>
            {h.sessions_this_week} sessions in the last 7 days · {h.sessions_total} in total
          </Text>
          {h.events.length ? (
            <>
              <Text style={[s.kicker, {color: C.dim, fontSize: u(20), marginTop: u(22)}]}>The coach noticed</Text>
              {h.events.slice(0, 3).map((e, i) => (
                <Text key={i} style={[s.body, {fontSize: u(24), lineHeight: u(32), marginTop: u(8)}]}>
                  {e.text}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}
