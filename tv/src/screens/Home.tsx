import React from 'react';
import {Text, View} from 'react-native';
import {HouseholdView, LEVEL_NAMES} from '../api';
import {Avatar, C, FocusButton, s, u} from '../ui/kit';
import {Figure} from '../ui/Figure';

export function Home({h, t, onStart, onReset, error}: {h: HouseholdView; t: number; onStart: () => void; onReset: () => void; error: string | null}) {
  // Last 7 days in the household's time zone (computed by the service), oldest first.
  const week = h.week ?? [];
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
        {error ? <Text style={[s.dim, {color: C.red, marginTop: u(14)}]}>{error}</Text> : null}
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
                <View style={{width: u(46), height: u(46), borderRadius: u(23), backgroundColor: d.done ? C.green : 'transparent', borderWidth: u(3), borderColor: d.today ? C.amber : d.done ? C.green : C.line}} />
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
