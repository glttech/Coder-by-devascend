import NotificationPrefsForm from '@/components/NotificationPrefsForm';
export default function NotificationsSettingsPage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Notification Preferences</h1>
      <NotificationPrefsForm />
    </div>
  );
}
