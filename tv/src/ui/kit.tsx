// Shared look for a TV seen from the couch: big type, high contrast, and a focus state you can
// spot from three meters away (amber border, slight lift).
import React, {useState} from 'react';
import {Dimensions, Pressable, StyleSheet, Text, View, ViewStyle} from 'react-native';
import {Svg, Circle, Path} from '@amazon-devices/react-native-svg';
import qrcode from 'qrcode-generator';

// Layouts are designed on a 1920 x 1080 canvas; Vega reports the screen in density-independent
// units (960 x 540 on a 1080p TV), so every size goes through u().
const K = Dimensions.get('window').width / 1920;
export const u = (n: number) => Math.round(n * K * 10) / 10;

export const C = {
  bg: '#0E1116',
  panel: '#171B23',
  panel2: '#1F2430',
  line: '#2C3240',
  text: '#F4F1EA',
  dim: '#A3A9B5',
  faint: '#6B7280',
  amber: '#FFB547',
  green: '#7BD389',
  red: '#FF7A7A',
};

export function FocusButton({label, sub, onPress, preferred, style, tone = 'normal', small, onFocusChange, testID}: {
  label: string; sub?: string; onPress: () => void; preferred?: boolean; style?: ViewStyle; tone?: 'normal' | 'primary' | 'quiet'; small?: boolean; onFocusChange?: (f: boolean) => void; testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      hasTVPreferredFocus={preferred}
      onPress={onPress}
      onFocus={() => { setFocused(true); onFocusChange?.(true); }}
      onBlur={() => { setFocused(false); onFocusChange?.(false); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        s.btn,
        small && s.btnSmall,
        tone === 'primary' && s.btnPrimary,
        tone === 'quiet' && s.btnQuiet,
        focused && s.btnFocused,
        focused && tone === 'primary' && s.btnPrimaryFocused,
        style,
      ]}>
      <Text style={[s.btnText, small && s.btnTextSmall, focused && tone === 'primary' && s.onAmber]}>{label}</Text>
      {sub ? <Text style={[s.btnSub, focused && tone === 'primary' && s.onAmber]}>{sub}</Text> : null}
    </Pressable>
  );
}

export function Avatar({name, color, size = u(64)}: {name: string; color: string; size?: number}) {
  return (
    <View style={{width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center'}}>
      <Text style={{color: '#111', fontSize: size * 0.46, fontWeight: '800'}}>{name.replace('Grandpa ', '')[0]}</Text>
    </View>
  );
}

export function Tag({text, color = C.dim}: {text: string; color?: string}) {
  return (
    <View style={[s.tag, {borderColor: color}]}>
      <Text style={[s.tagText, {color}]}>{text}</Text>
    </View>
  );
}

export function QR({value, size}: {value: string; size: number}) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return (
    <View style={{backgroundColor: '#fff', padding: size * 0.06, borderRadius: u(16)}}>
      <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
        <Path d={d} fill="#0E1116" />
      </Svg>
    </View>
  );
}

// Countdown ring: the arc shrinks as the block runs out.
export function Ring({fraction, size, color, children}: {fraction: number; size: number; color: string; children?: React.ReactNode}) {
  const r = 44;
  const f = Math.max(0, Math.min(1, fraction));
  const a = f * 2 * Math.PI;
  const x = 50 + r * Math.sin(a);
  const y = 50 - r * Math.cos(a);
  const d = f >= 0.999 ? `M50 6 A44 44 0 1 1 49.99 6` : `M50 6 A44 44 0 ${a > Math.PI ? 1 : 0} 1 ${x} ${y}`;
  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{position: 'absolute'}}>
        <Circle cx={50} cy={50} r={r} stroke={C.line} strokeWidth={7} fill="none" />
        {f > 0.001 ? <Path d={d} stroke={color} strokeWidth={7} fill="none" strokeLinecap="round" /> : null}
      </Svg>
      {children}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: C.bg, paddingHorizontal: u(80), paddingVertical: u(56)},
  kicker: {color: C.amber, fontSize: u(24), fontWeight: '800', letterSpacing: u(3), textTransform: 'uppercase'},
  h1: {color: C.text, fontSize: u(64), fontWeight: '800', letterSpacing: u(-1), marginTop: u(6)},
  h2: {color: C.text, fontSize: u(40), fontWeight: '800'},
  body: {color: C.text, fontSize: u(30), lineHeight: u(42)},
  dim: {color: C.dim, fontSize: u(26), lineHeight: u(36)},
  panel: {backgroundColor: C.panel, borderRadius: u(28), padding: u(32), borderWidth: u(2), borderColor: C.line},
  btn: {backgroundColor: C.panel2, borderRadius: u(22), paddingVertical: u(24), paddingHorizontal: u(40), borderWidth: u(4), borderColor: 'transparent', alignItems: 'center', justifyContent: 'center'},
  btnSmall: {paddingVertical: u(14), paddingHorizontal: u(26), borderRadius: u(16)},
  btnFocused: {borderColor: C.amber, transform: [{scale: 1.05}], backgroundColor: '#2A2F3B'},
  btnPrimary: {backgroundColor: '#3A2E14'},
  btnPrimaryFocused: {backgroundColor: C.amber, borderColor: '#FFE2A8'},
  btnQuiet: {backgroundColor: 'transparent', borderColor: C.line},
  btnText: {color: C.text, fontSize: u(32), fontWeight: '800'},
  btnTextSmall: {fontSize: u(24)},
  onAmber: {color: '#1A1205'},
  btnSub: {color: C.dim, fontSize: u(22), marginTop: u(6)},
  tag: {borderWidth: u(2), borderRadius: u(999), paddingHorizontal: u(14), paddingVertical: u(4), marginRight: u(10), marginTop: u(8), alignSelf: 'flex-start'},
  tagText: {fontSize: u(20), fontWeight: '700'},
});
