const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export function inviteEmailTemplate(email: string, inviteUrl: string, role: string) {
  return {
    subject: 'You have been invited to join Coder by DevAscend',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2>You're invited</h2>
        <p>You've been invited to join as <strong>${role}</strong>.</p>
        <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Accept Invitation</a>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">This link expires in 7 days. If you didn't expect this, ignore this email.</p>
      </div>
    `,
    text: `You've been invited to join Coder by DevAscend as ${role}.\n\nAccept: ${inviteUrl}\n\nExpires in 7 days.`,
  };
}

export function approvalNeededEmailTemplate(taskTitle: string, taskId: string, requesterName: string) {
  const taskUrl = `${appUrl}/tasks/${taskId}`;
  return {
    subject: `Approval needed: ${taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2>Approval required</h2>
        <p>${requesterName} has submitted <strong>${taskTitle}</strong> for approval.</p>
        <a href="${taskUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Review Task</a>
      </div>
    `,
    text: `${requesterName} needs your approval for: ${taskTitle}\n\nReview: ${taskUrl}`,
  };
}

export function runCompletedEmailTemplate(taskTitle: string, taskId: string, status: string) {
  const taskUrl = `${appUrl}/tasks/${taskId}`;
  const emoji = status === 'succeeded' ? '✅' : '❌';
  return {
    subject: `${emoji} Agent run ${status}: ${taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2>${emoji} Run ${status}</h2>
        <p>An agent run for <strong>${taskTitle}</strong> has ${status}.</p>
        <a href="${taskUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">View Task</a>
      </div>
    `,
    text: `Agent run ${status} for: ${taskTitle}\n\nView: ${taskUrl}`,
  };
}
