import { TextInput, StyleSheet, type TextInputProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type InputProps = TextInputProps & {
  placeholder?: string;
};

export const Input = ({ style, placeholder, ...props }: InputProps) => {
  const colorScheme = useColorScheme();
  const textColor = Colors[colorScheme ?? 'light'].text;
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = Colors[colorScheme ?? 'light'].icon;
  const placeholderColor = Colors[colorScheme ?? 'light'].tabIconDefault;

  return (
    <TextInput
      style={[
        styles.input,
        {
          color: textColor,
          backgroundColor,
          borderColor,
          placeholderTextColor: placeholderColor,
        },
        style,
      ]}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
});

