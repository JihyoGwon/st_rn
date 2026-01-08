import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ButtonProps = PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary';
};

export const Button = ({ title, variant = 'primary', style, ...props }: ButtonProps) => {
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme ?? 'light'].tint;
  const backgroundColor = variant === 'primary' ? tintColor : 'transparent';
  const textColor = variant === 'primary' ? '#fff' : tintColor;
  const borderColor = variant === 'secondary' ? tintColor : 'transparent';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? (variant === 'primary' ? tintColor + 'CC' : 'transparent') : backgroundColor,
          borderColor,
        },
        style,
      ]}
      {...props}
    >
      <ThemedText style={[styles.buttonText, { color: textColor }]}>{title}</ThemedText>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

