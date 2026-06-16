import { sendEmail } from './sender';
import { inviteEmailTemplate, approvalNeededEmailTemplate, runCompletedEmailTemplate } from './templates';

type EmailEvent =
  | { type: 'invite'; to: string; inviteUrl: string; role: string }
  | { type: 'approval_needed'; to: string; taskTitle: string; taskId: string; requesterName: string }
  | { type: 'run_completed'; to: string; taskTitle: string; taskId: string; status: string };

export async function dispatchEmail(event: EmailEvent): Promise<void> {
  let payload: { subject: string; html: string; text: string };

  if (event.type === 'invite') {
    payload = inviteEmailTemplate(event.to, event.inviteUrl, event.role);
  } else if (event.type === 'approval_needed') {
    payload = approvalNeededEmailTemplate(event.taskTitle, event.taskId, event.requesterName);
  } else {
    payload = runCompletedEmailTemplate(event.taskTitle, event.taskId, event.status);
  }

  // Fire-and-forget; never block the request
  sendEmail({ to: event.to, ...payload }).catch((err) => {
    console.error('[email] dispatch error:', err);
  });
}
