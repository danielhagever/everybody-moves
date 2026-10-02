import React from 'react';
import {Text, View} from 'react-native';
import {Session} from '../api';
import {Avatar, C, FocusButton, Tag, s, u} from '../ui/kit';
import {Figure} from '../ui/Figure';

export function PlanScreen({session, t, onStart, onBack}: {session: Session; t: number; onStart: () => void; onBack: () => void}) {
  const plan = session.plan!;
  const people = session.members.filter(m => session.presence.some(p => p.member_id === m.id && p.present));
  const work = plan.blocks.filter(b => b.kind === 'work');
  const moves: string[] = [];
  for (const b of work) if (!moves.includes(b.move_id)) moves.push(b.move_id);
  const pace = session.pace !== 1;
  return (
    <View style={s.screen}>
      <Text style={s.kicker}>Today's plan</Text>
      <View style={{flexDirection: 'row', alignItems: 'flex-end'}}>
        <Text style={s.h1}>{plan.minutes} minutes · {plan.focus}</Text>
        {pace ? <Tag text="Demo pace: 5x faster" color={C.amber} /> : null}
      </View>
      <View style={[s.panel, {marginTop: u(26), flexDirection: 'row', alignItems: 'center'}]}>
        <View style={{width: u(10), alignSelf: 'stretch', backgroundColor: C.amber, borderRadius: u(5), marginRight: u(28)}} />
        <View style={{flex: 1}}>
          <Text style={[s.kicker, {fontSize: u(18), color: C.dim}]}>Coach</Text>
          <Text style={[s.body, {fontSize: u(34), lineHeight: u(48), marginTop: u(6)}]}>{session.coach?.text}</Text>
        </View>
      </View>
      <View style={{flexDirection: 'row', marginTop: u(26), flex: 1}}>
        {moves.map(id => {
          const b = work.find(x => x.move_id === id)!;
          return (
            <View key={id} style={[s.panel, {flex: 1, marginRight: u(20), padding: u(22)}]}>
              <View style={{alignItems: 'center'}}>
                <Figure anim={id} t={t} size={u(150)} color={C.text} />
              </View>
              <Text style={[s.h2, {fontSize: u(30), marginTop: u(4)}]}>{b.move}</Text>
              {people.map(m => {
                const v = b.per_member.find(x => x.member_id === m.id);
                if (!v) return null;
                return (
                  <View key={m.id} style={{flexDirection: 'row', alignItems: 'center', marginTop: u(12)}}>
                    <Avatar name={m.name} color={m.color} size={u(34)} />
                    <Text style={[s.dim, {fontSize: u(22), marginLeft: u(12), flex: 1, color: v.why ? m.color : C.dim}]} numberOfLines={2}>
                      {v.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
      <View style={{flexDirection: 'row', alignItems: 'center', marginTop: u(26)}}>
        <FocusButton testID="start-workout" label="Start" tone="primary" preferred onPress={onStart} style={{paddingHorizontal: u(90)}} />
        <FocusButton label="Back" tone="quiet" small onPress={onBack} style={{marginLeft: u(24)}} />
        <Text style={[s.dim, {fontSize: u(22), marginLeft: u(32), flex: 1}]}>General fitness guidance, not medical advice. Stop any move that hurts.</Text>
      </View>
    </View>
  );
}
