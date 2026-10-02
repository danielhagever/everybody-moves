import React from 'react';
import {Text, View} from 'react-native';
import {Rating, Session, Summary} from '../api';
import {Avatar, C, FocusButton, s, u} from '../ui/kit';

const WORDS: Record<Rating, string> = {easy: 'Easy', right: 'Just right', hard: 'Hard'};

// After the last block: everyone says how it felt, on their phone or with the remote.
export function Rate({session, onRate, onFinish, busy, error}: {session: Session; onRate: (member: string, r: Rating) => void; onFinish: () => void; busy: boolean; error: string | null}) {
  const people = session.members.filter(m => session.presence.some(p => p.member_id === m.id && p.present));
  const done = people.filter(m => session.presence.find(p => p.member_id === m.id)?.rating).length;
  return (
    <View style={s.screen}>
      <Text style={s.kicker}>Nice work</Text>
      <Text style={s.h1}>How did that feel?</Text>
      <Text style={[s.dim, {marginTop: u(10)}]}>Each answer sets that person's level for next time. Answer on your phone, or here with the remote.</Text>
      <View style={{marginTop: u(28)}}>
        {people.map((m, i) => {
          const p = session.presence.find(x => x.member_id === m.id);
          return (
            <View key={m.id} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderRadius: u(24), padding: u(18), marginBottom: u(14), borderLeftWidth: u(10), borderLeftColor: m.color}}>
              <Avatar name={m.name} color={m.color} size={u(60)} />
              <Text style={[s.body, {fontWeight: '800', marginLeft: u(20), width: u(300)}]}>{m.name}</Text>
              {(['easy', 'right', 'hard'] as Rating[]).map((r, j) => (
                <FocusButton
                  key={r}
                  label={WORDS[r]}
                  small
                  tone={p?.rating === r ? 'primary' : 'quiet'}
                  preferred={i === 0 && j === 1}
                  onPress={() => onRate(m.id, r)}
                  style={{marginRight: u(16), minWidth: u(200), ...(p?.rating === r ? {borderColor: m.color} : {})}}
                />
              ))}
            </View>
          );
        })}
      </View>
      <View style={{flexDirection: 'row', alignItems: 'center', marginTop: u(14)}}>
        <FocusButton testID="finish" label={busy ? 'Saving…' : 'See what changes for next time'} tone="primary" onPress={() => !busy && onFinish()} />
        <Text style={[s.dim, {marginLeft: u(28)}]}>{done} of {people.length} answered</Text>
      </View>
      {error ? <Text style={[s.dim, {color: C.red, marginTop: u(12)}]}>{error}</Text> : null}
    </View>
  );
}

export function SummaryScreen({summary, onHome}: {summary: Summary; onHome: () => void}) {
  return (
    <View style={s.screen}>
      <Text style={s.kicker}>Done</Text>
      <Text style={s.h1}>
        {summary.completed_blocks} of {summary.planned_blocks} work blocks{summary.who.length > 1 ? ', together' : ''}.
      </Text>
      <Text style={[s.dim, {marginTop: u(10)}]}>{summary.who.join(', ')}</Text>
      <View style={[s.panel, {marginTop: u(34)}]}>
        <Text style={[s.kicker, {color: C.dim, fontSize: u(20)}]}>Next time</Text>
        {summary.changes.length ? (
          summary.changes.map((c, i) => (
            <Text key={i} style={[s.body, {fontSize: u(34), lineHeight: u(46), marginTop: u(14)}]}>
              {c[0].toUpperCase() + c.slice(1)}.
            </Text>
          ))
        ) : (
          <Text style={[s.body, {marginTop: u(14)}]}>Everyone stays at the same level. See you tomorrow.</Text>
        )}
      </View>
      {summary.next ? (
        <View style={[s.panel, {marginTop: u(24)}]}>
          <Text style={[s.kicker, {color: C.dim, fontSize: u(20)}]}>Your household's pattern</Text>
          <Text style={[s.body, {fontSize: u(30), lineHeight: u(42), marginTop: u(12)}]}>
            Next session around this time: {summary.next.minutes} minutes, because {summary.next.reason.replace(/, so .*$/, '')}.
          </Text>
        </View>
      ) : null}
      <View style={{flexDirection: 'row', marginTop: u(34)}}>
        <FocusButton testID="home" label="Back to home" tone="primary" preferred onPress={onHome} />
      </View>
    </View>
  );
}
