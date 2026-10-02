import React from 'react';
import {Text, View} from 'react-native';
import {Block, Session} from '../api';
import {Avatar, C, FocusButton, Ring, Tag, s, u} from '../ui/kit';
import {Figure} from '../ui/Figure';

const LABEL: Record<Block['kind'], string> = {warmup: 'Warm-up', work: 'Go', rest: 'Rest · next up', cooldown: 'Cool-down'};
const KIND_COLOR: Record<Block['kind'], string> = {warmup: '#7CC6FE', work: C.amber, rest: '#8B93A3', cooldown: '#B79CED'};

export function Workout({session, index, remaining, t, onControl, coachLine}: {
  session: Session; index: number; remaining: number; t: number; onControl: (a: 'pause' | 'resume' | 'next' | 'prev' | 'end') => void; coachLine: string | null;
}) {
  const plan = session.plan!;
  const b = plan.blocks[index];
  const paused = !!session.timing.paused_at;
  const people = session.members.filter(m => session.presence.some(p => p.member_id === m.id && p.present));
  const color = KIND_COLOR[b.kind];
  const resting = b.kind === 'rest';
  const total = plan.blocks.reduce((a, x) => a + x.seconds, 0);
  return (
    <View style={[s.screen, {paddingVertical: u(44)}]}>
      <View style={{flexDirection: 'row', flex: 1}}>
        {/* Left: the move, demonstrated, with the clock. */}
        <View style={{flex: 1.05, marginRight: u(40)}}>
          <Text style={[s.kicker, {color}]}>{paused ? 'Paused' : LABEL[b.kind]}</Text>
          <Text style={[s.h1, {fontSize: u(76)}]}>{b.move}</Text>
          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
            <View style={[s.panel, {padding: u(10), opacity: resting ? 0.75 : 1}]}>
              <Figure anim={b.move_id} t={t} size={u(430)} color={resting ? C.dim : C.text} still={paused} />
            </View>
            <View style={{marginLeft: u(44), alignItems: 'center'}}>
              <Ring fraction={remaining / b.seconds} size={u(250)} color={color}>
                <Text style={{color: C.text, fontSize: u(96), fontWeight: '800'}}>{remaining}</Text>
              </Ring>
              <Text style={[s.dim, {marginTop: u(10)}]}>seconds</Text>
            </View>
          </View>
        </View>
        {/* Right: everyone's own version of this move. */}
        <View style={{flex: 1}}>
          <Text style={[s.kicker, {color: C.dim}]}>{resting ? 'Get ready for your version' : 'Your version'}</Text>
          {people.map(m => {
            const v = b.per_member.find(x => x.member_id === m.id);
            if (!v) return null;
            return (
              <View key={m.id} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderRadius: u(24), padding: u(16), marginTop: u(14), borderLeftWidth: u(10), borderLeftColor: m.color}}>
                <View style={{backgroundColor: C.panel2, borderRadius: u(18)}}>
                  <Figure anim={v.anim} t={t + 0.3} size={u(112)} color={m.color} still={paused || resting} />
                </View>
                <View style={{marginLeft: u(20), flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Avatar name={m.name} color={m.color} size={u(34)} />
                    <Text style={[s.dim, {fontSize: u(24), marginLeft: u(10), fontWeight: '700', color: C.text}]}>{m.name}</Text>
                  </View>
                  <Text style={[s.h2, {fontSize: u(34), marginTop: u(4)}]} numberOfLines={1}>{v.name}</Text>
                  <Text style={[s.dim, {fontSize: u(22)}]} numberOfLines={1}>{v.cue}</Text>
                  {v.why ? <Tag text={v.why} color={m.color} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
      {/* Bottom: the whole session as a strip, the coach's last line, and remote controls. */}
      <View style={{flexDirection: 'row', height: u(14), marginTop: u(24), borderRadius: u(7), overflow: 'hidden', backgroundColor: C.line}}>
        {plan.blocks.map((x, i) => (
          <View key={i} style={{flex: x.seconds / total, backgroundColor: i < index ? KIND_COLOR[x.kind] : i === index ? '#fff' : 'transparent', marginRight: u(2), opacity: i < index ? 0.55 : 1}} />
        ))}
      </View>
      <View style={{flexDirection: 'row', alignItems: 'center', marginTop: u(20)}}>
        <FocusButton label="◀" small tone="quiet" onPress={() => onControl('prev')} />
        <FocusButton testID="pause" label={paused ? 'Resume' : 'Pause'} small preferred onPress={() => onControl(paused ? 'resume' : 'pause')} style={{marginLeft: u(16), minWidth: u(180)}} />
        <FocusButton label="Skip ▶" small tone="quiet" onPress={() => onControl('next')} style={{marginLeft: u(16)}} />
        <FocusButton label="End" small tone="quiet" onPress={() => onControl('end')} style={{marginLeft: u(16)}} />
        <Text style={[s.dim, {marginLeft: u(32), flex: 1, fontSize: u(24), fontStyle: 'italic'}]} numberOfLines={1}>
          {coachLine ? `Coach: “${coachLine}”` : `Block ${index + 1} of ${plan.blocks.length}${session.pace !== 1 ? ' · demo pace' : ''}`}
        </Text>
      </View>
    </View>
  );
}
