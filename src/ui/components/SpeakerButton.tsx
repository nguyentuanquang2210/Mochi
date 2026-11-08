import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Feather } from './Icons';
import { SpeechService, SpeechAccent } from '../../services/speech';

interface SpeakerButtonProps {
  text: string;
  size?: number;
  color?: string;
  activeColor?: string;
  style?: ViewStyle;
  accent?: SpeechAccent;
  rate?: number;
}

export let lastSpeakerPressTimestamp = 0;

export function SpeakerButton({
  text,
  size = 18,
  color = '#4A5568',
  activeColor = '#2563EB',
  style,
  accent,
  rate
}: SpeakerButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePress = (e?: any) => {
    lastSpeakerPressTimestamp = Date.now();
    // Ngăn chặn sự kiện chạm lan ra ngoài (ví dụ lan ra card swipe/flip)
    if (e?.stopPropagation) {
      e.stopPropagation();
    }

    if (!text?.trim()) return;

    setIsPlaying(true);
    // Bắn phát âm tức thì không await để không làm trễ UI thread
    SpeechService.speak(text, { accent, rate }).catch(() => {});
    setTimeout(() => {
      setIsPlaying(false);
    }, 650);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={handlePress}
      style={[styles.button, isPlaying && styles.buttonActive, style]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Feather
        name={isPlaying ? 'volume-2' : 'volume-1'}
        size={size}
        color={isPlaying ? activeColor : color}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.04)'
  },
  buttonActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)'
  }
});

