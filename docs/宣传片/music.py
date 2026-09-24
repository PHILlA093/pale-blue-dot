# -*- coding: utf-8 -*-
"""
穷观 · 宣传片配乐 v2(纯 Python 标准库逐样本合成)
=================================================
v1 是"电影暗色氛围"(小调长音 + 低频脉冲),偏沉。
v2 换成 Apple 发布会那种商务质感:
  · 明亮大调(C 大调 I-V-vi-IV),和声每 2.5 秒一换 —— 有前进感
  · 招牌织体:八分音符琶音(拨奏/钢琴感),带点八分回声
  · 暖而不糊的底:轻柔 pad + 干净的 sub bass(换和弦才起音,不做长驻嗡鸣)
  · 极轻的节拍:每拍一声"tick"、每小节一声低频"心h跳",不打鼓
  · 高频闪光:稀疏钟音 + 乒乓回声,越到后面越亮
  · 段间 1.5 秒白噪渐强(riser),对应片子的 5/17/29/41 秒分镜
  · 母带:温和软限幅(不做 tanh 染色,保通透),峰值 -1 dBFS
分镜强度:0-5 只铺 pad → 5s 进琶音与节拍 → 17s 进低音 → 29s 进闪光 → 41s 收束
用法: python music.py <输出 wav 路径>
"""
import math
import random
import sys
import wave
import array

SR = 48000
SRF = float(SR)
DUR = 90.0
# 分镜时间轴(片头/知识云/破卷/观澜/片尾边界),配器强度按它分段:
#   SEG[1]=琶音与节拍进入(知识云) SEG[2]=低音进入(18s)
#   SEG[4]=整体更亮更密(观澜 67s)  SEG[5]=片尾收束(85s)
SEG = [0.0, 7.0, 18.0, 48.0, 67.0, 85.0, 90.0]
# 每段切换前的白噪渐强位置
RISERS = [5.6, 16.6, 31.6, 46.6, 65.6, 83.6]
BPM = 96.0
BEAT = 60.0 / BPM          # 0.625s
BAR = BEAT * 4.0           # 2.5s —— 一个和弦一小节

# 音名 -> 频率(C 大调体系)
N = {
    'F1': 43.65, 'G1': 49.00, 'A1': 55.00, 'C2': 65.41, 'D2': 73.42, 'E2': 82.41,
    'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.26, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00,
}

# I - V - vi - IV in C,每小节一个和弦
PROG = {
    'C':  {'bass': 'C2', 'pad': ['C3', 'E3', 'G3'], 'arp': ['C4', 'E4', 'G4', 'C5'], 'bells': ['G4', 'E5']},
    'G':  {'bass': 'G1', 'pad': ['G3', 'B3', 'D3'], 'arp': ['G3', 'B3', 'D4', 'G4'], 'bells': ['D5', 'B4']},
    'Am': {'bass': 'A1', 'pad': ['A2', 'C4', 'E3'], 'arp': ['A3', 'C4', 'E4', 'A4'], 'bells': ['E5', 'C5']},
    'F':  {'bass': 'F1', 'pad': ['F3', 'A3', 'C4'], 'arp': ['F3', 'A3', 'C4', 'F4'], 'bells': ['C5', 'A4']},
}
ORDER = ['C', 'G', 'Am', 'F']
CHORDS = []
_k = 0
_t = 0.0
while _t < DUR - 0.001:
    CHORDS.append((_t, min(_t + BAR, DUR), ORDER[_k % 4]))
    _t += BAR
    _k += 1

sin = math.sin
TWO_PI = 2.0 * math.pi


def smoothstep(t):
    if t <= 0.0:
        return 0.0
    if t >= 1.0:
        return 1.0
    return t * t * (3.0 - 2.0 * t)


def env_at(t, a, r, dur):
    """起音 a 秒、收尾 r 秒的平滑包络"""
    return smoothstep(t / a) * smoothstep((dur - t) / r)


def add_note(L, R, start, dur, freq, amp, pan, attack=0.01, release=0.25,
             decay=None, harm2=0.0, harm3=0.0, detune=0.0):
    """单音:相位与包络都递推累乘,避免逐样本调用 exp"""
    n0 = int(start * SR)
    n = int(dur * SR)
    if n0 >= len(L):
        return
    if n0 + n > len(L):
        n = len(L) - n0
    if n <= 0:
        return
    pl = math.sqrt(0.5 * (1.0 - pan))
    pr = math.sqrt(0.5 * (1.0 + pan))
    w = TWO_PI * freq / SRF
    w2 = w * 2.0
    w3 = w * 3.0
    wd = TWO_PI * freq * (1.0 + detune) / SRF
    ph = ph2 = ph3 = phd = 0.0
    k = 1.0
    kd = math.exp(-1.0 / (decay * SRF)) if decay else 1.0
    for i in range(n):
        t = i / SRF
        e = env_at(t, attack, release, dur) * k
        # 注意:起音阶段包络本来就接近 0,这里只能 continue 不能 break
        # (v1→v2 时写成 break,慢起音的音符第一帧就被跳出,整层静音)
        if e <= 0.0:
            pass
        else:
            s = sin(ph) + harm2 * sin(ph2) + harm3 * sin(ph3)
            if detune:
                s = (s + sin(phd)) * 0.5
            v = s * amp * e
            j = n0 + i
            L[j] += v * pl
            R[j] += v * pr
        ph += w
        ph2 += w2
        ph3 += w3
        phd += wd
        k *= kd
        if k < 1e-4:            # 指数衰减到底了,可以收工
            break


def add_pad(L, R, start, dur, notes, amp, attack=0.9, release=1.2):
    for m, nm in enumerate(notes):
        pan = (-0.5, 0.0, 0.5)[m % 3]
        add_note(L, R, start, dur, N[nm], amp, pan, attack=attack, release=release,
                 harm2=0.10, detune=0.0016 if m % 2 else -0.0013)


def add_bass(L, R, start, dur, note, amp):
    add_note(L, R, start, dur, N[note], amp, 0.0, attack=0.05, release=0.45, harm2=0.22)


def add_pluck(L, R, start, note, amp, pan):
    """琶音拨奏:快起音 + 指数衰减 + 一点二三次谐波(玻璃/马林巴感)"""
    add_note(L, R, start, 0.55, N[note], amp, pan, attack=0.004, release=0.05,
             decay=0.30, harm2=0.30, harm3=0.08)


def add_echo(L, R, start, note, amp, pan, step, times, gain):
    """点八分乒乓回声 —— Apple 味主要来自这里"""
    a = amp
    p = pan
    for i in range(1, times + 1):
        a *= gain
        if a < 0.002:
            break
        p = -p
        add_pluck(L, R, start + step * i, note, a, p * 0.8)


def add_bell(L, R, start, note, amp, pan):
    add_note(L, R, start, 2.6, N[note], amp, pan, attack=0.006, release=0.9,
             decay=0.85, harm2=0.18)


def add_tick(L, R, start, amp):
    """每拍一声极轻的高频 tick:给商务节奏一个"表针"般的推进"""
    n0 = int(start * SR)
    n = int(0.045 * SR)
    if n0 + n > len(L):
        return
    rnd = random.Random(int(start * 1000) & 0xffff)
    lp = 0.0
    for i in range(n):
        t = i / SRF
        w = rnd.uniform(-1.0, 1.0)
        lp += 0.35 * (w - lp)
        e = smoothstep(t / 0.002) * smoothstep((0.045 - t) / 0.03)
        v = lp * amp * e
        L[n0 + i] += v * 0.62
        R[n0 + i] += v * 0.62


def add_heart(L, R, start, amp):
    """每小节一记很轻的低频心跳(不做鼓)"""
    add_note(L, R, start, 0.5, 58.0, amp, 0.0, attack=0.008, release=0.30, decay=0.12)


def add_riser(L, R, start, dur, amp):
    """段间白噪渐强"""
    n0 = int(start * SR)
    n = int(dur * SR)
    if n0 + n > len(L):
        n = len(L) - n0
    if n <= 0:
        return
    rnd = random.Random(7)
    lp = 0.0
    hp = 0.0
    for i in range(n):
        t = i / SRF
        w = rnd.uniform(-1.0, 1.0)
        lp += 0.22 * (w - lp)
        hp = lp - hp * 0.0
        e = (t / dur) ** 2.2 * smoothstep((dur - t) / 0.25)
        v = (lp - w * 0.25) * amp * e
        L[n0 + i] += v * 0.7
        R[n0 + i] += v * 0.7


def add_air(L, R, amp):
    n = int(DUR * SR)
    lp = 0.0
    rnd = random.Random(20260918)
    for i in range(n):
        t = i / SRF
        w = rnd.uniform(-1.0, 1.0)
        lp += 0.02 * (w - lp)
        f = smoothstep(t / 4.0) * smoothstep((DUR - t) / 4.0)
        v = lp * amp * f
        L[i] += v * 0.7
        R[i] += v * 0.3


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
    n = int(DUR * SR)
    L = array.array('d', bytes(8 * n))
    R = array.array('d', bytes(8 * n))

    print('air...')
    add_air(L, R, 0.016)

    print('pads + bass...')
    for i, (a, b, name) in enumerate(CHORDS):
        c = PROG[name]
        add_pad(L, R, a, (b - a) + 1.9, c['pad'], 0.085, attack=0.85, release=1.15)
        if a >= SEG[2]:                                  # 学科巡礼起进低音
            add_bass(L, R, a, (b - a) + 0.6, c['bass'], 0.115)

    print('plucks (8ths) + echo...')
    t = SEG[1]                                           # 知识云出现,琶音进入
    idx = 0
    while t < SEG[5]:
        slot = int(t / BAR)
        name = CHORDS[min(slot, len(CHORDS) - 1)][2]
        arp = PROG[name]['arp']
        note = arp[idx % len(arp)]
        # 每小节第一拍稍强,形成无形的小节感
        amp = 0.075 if (idx % 8 == 0) else 0.055
        if t >= SEG[4]:                                  # 观澜段再亮一档
            amp *= 1.12
        pan = (-0.45, 0.30, -0.25, 0.45)[idx % 4]
        add_pluck(L, R, t, note, amp, pan)
        add_echo(L, R, t, note, amp, pan, BEAT * 0.75, 3, 0.30)
        t += BEAT * 0.5
        idx += 1

    print('bells...')
    for i, (a, b, name) in enumerate(CHORDS):
        if a < SEG[1] - 0.6 and i > 0:
            continue
        bells = PROG[name]['bells']
        if a >= SEG[4]:                                  # 观澜段闪光更密
            add_bell(L, R, a + 0.15, bells[1], 0.058, 0.55)
            add_bell(L, R, a + 1.35, bells[0], 0.050, -0.55)
        elif a >= SEG[1]:
            add_bell(L, R, a + 0.35, bells[0], 0.045, 0.5)
    add_bell(L, R, SEG[5] + 0.6, 'E5', 0.055, 0.0)       # 片尾收束音
    add_bell(L, R, SEG[5] + 1.9, 'C5', 0.048, 0.0)

    print('ticks + heartbeat...')
    t = SEG[1]
    beat = 0
    while t < SEG[5]:
        add_tick(L, R, t, 0.020 if beat % 4 else 0.030)
        if beat % 4 == 0:
            add_heart(L, R, t, 0.055)
        t += BEAT
        beat += 1

    print('risers...')
    for s in RISERS:
        add_riser(L, R, s, 1.4, 0.030)

    # 母带:温和软限幅(只削过 0.72 的部分,不做 tanh 染色)+ 首尾淡入淡出
    print('master...')
    peak = 0.0
    TH = 0.72
    for i in range(n):
        t = i / SRF
        f = smoothstep(t / 2.0) * smoothstep((DUR - t) / 3.2)
        l = L[i] * f
        r = R[i] * f
        if l > TH:
            l = TH + (l - TH) / (1.0 + (l - TH) * 3.0)
        elif l < -TH:
            l = -TH + (l + TH) / (1.0 - (l + TH) * 3.0)
        if r > TH:
            r = TH + (r - TH) / (1.0 + (r - TH) * 3.0)
        elif r < -TH:
            r = -TH + (r + TH) / (1.0 - (r + TH) * 3.0)
        L[i] = l
        R[i] = r
        if abs(l) > peak:
            peak = abs(l)
        if abs(r) > peak:
            peak = abs(r)
    scale = (0.891 / peak) if peak > 1e-9 else 1.0

    data = array.array('h', bytes(4 * n))
    for i in range(n):
        data[2 * i] = max(-32768, min(32767, int(L[i] * scale * 32767.0)))
        data[2 * i + 1] = max(-32768, min(32767, int(R[i] * scale * 32767.0)))
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print('peak %.4f -> scale %.3f' % (peak, scale))
    print('WROTE %s  %.1fs' % (out, DUR))


if __name__ == '__main__':
    main()
