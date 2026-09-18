import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    padding: 20,
    gap: 16,
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: '#121b2d',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#23314f',
  },
  badge: {
    color: '#8fd3ff',
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#b8c2d6',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  profileBox: {
    backgroundColor: '#0d1627',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#22304a',
    gap: 4,
  },
  profileLabel: {
    color: '#8fd3ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  profileEmail: {
    color: '#b8c2d6',
    fontSize: 13,
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
    marginBottom: 2,
  },
  userEmail: {
    color: '#8fd3ff',
    fontSize: 15,
  },
  feature: {
    color: '#d7def0',
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4d7cff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    flex: 1,
    backgroundColor: '#0d1627',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#29405f',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonSecondaryText: {
    color: '#8fd3ff',
    fontSize: 14,
    fontWeight: '700',
  },
});
