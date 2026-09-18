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
    marginBottom: 4,
  },
  label: {
    color: '#8fd3ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 4,
  },
  value: {
    color: '#d7def0',
    fontSize: 14,
  },
  description: {
    color: '#d7def0',
    fontSize: 14,
    lineHeight: 20,
  },
  logoutButton: {
    marginTop: 'auto',
    backgroundColor: '#381d24',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5c2d37',
  },
  logoutButtonText: {
    color: '#ffb5b5',
    fontSize: 15,
    fontWeight: '700',
  },
});
