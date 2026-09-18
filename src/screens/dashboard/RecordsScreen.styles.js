import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    padding: 20,
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#121b2d',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#23314f',
    gap: 8,
  },
  badge: {
    color: '#8fd3ff',
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#b8c2d6',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#11192a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#22304a',
    gap: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    color: '#d7def0',
    fontSize: 14,
    lineHeight: 20,
  },
  fieldList: {
    gap: 4,
  },
  fieldItem: {
    color: '#b8c2d6',
    fontSize: 13,
  },
  note: {
    color: '#8fd3ff',
    fontSize: 12,
    lineHeight: 18,
  },
});
