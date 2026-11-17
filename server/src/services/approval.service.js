import Approval from '../models/Approval.js';
import TaskAttachment from '../models/TaskAttachment.js';
import { ApiError } from '../utils/ApiError.js';
import { loadTask, isAssignee, canApprove, logActivity, participantIds, TASK_POPULATE } from './task.service.js';
import { notify } from './notification.service.js';
import { emitToDepartment, emitToTask } from '../sockets/index.js';
import { hasPermission } from '../middleware/auth.js';

export async function submitForApproval(req, id, { note, attachmentIds = [] }) {
  const task = await loadTask(id, req);
  if (!isAssignee(task, req.user._id) && !hasPermission(req, 'task:update_any')) throw ApiError.forbidden('Only an assignee can submit this task');
  if (!['in_progress', 'revision_required', 'assigned', 'acknowledged'].includes(task.status)) throw ApiError.badRequest(`Task cannot be submitted from status "${task.status}"`);

  const lastRound = await Approval.findOne({ task: task._id }).sort('-round').select('round').lean();
  const round = (lastRound?.round || 0) + 1;

  if (attachmentIds.length) {
    const count = await TaskAttachment.countDocuments({ _id: { $in: attachmentIds }, task: task._id });
    if (count !== attachmentIds.length) throw ApiError.badRequest('Invalid attachment reference');
  }

  const approval = await Approval.create({ task: task._id, round, submittedBy: req.user._id, submissionNote: note, deliverables: attachmentIds });
  if (attachmentIds.length) await TaskAttachment.updateMany({ _id: { $in: attachmentIds } }, { kind: 'deliverable', version: round, approval: approval._id });

  if (task.requiresApproval) {
    task.status = 'under_review';
    task.submittedAt = new Date();
  } else {
    task.status = 'completed';
    task.completedAt = new Date();
    task.progress = 100;
    approval.decision = 'approved';
    approval.decidedAt = new Date();
    await approval.save();
  }
  task.updatedBy = req.user._id;
  await task.save();
  await logActivity(task._id, req.user._id, 'submitted', `submitted deliverable (round ${round})${note ? `: ${note}` : ''}`, { approval: approval._id, round });

  const reviewers = task.approvers?.length ? task.approvers.map((a) => a._id) : [task.assignedBy._id];
  if (task.requiresApproval) {
    await notify({ recipients: reviewers, actor: req.user._id, type: 'approval_requested', title: `Approval requested: ${task.taskId}`, message: `${req.user.name} submitted "${task.title}" for review.${note ? ` Note: ${note}` : ''}`, entityType: 'task', entityId: task._id, link: `/tasks/${task._id}` });
  }
  await task.populate(TASK_POPULATE);
  emitToDepartment(task.department._id || task.department, 'task:updated', task.toJSON());
  emitToTask(task._id, 'task:updated', task.toJSON());
  return { task, approval };
}

export async function decideApproval(req, id, { decision, comment }) {
  const task = await loadTask(id, req);
  if (!canApprove(req, task)) throw ApiError.forbidden('You are not authorized to review this task');
  if (task.status !== 'under_review') throw ApiError.badRequest('Task is not under review');
  if (decision !== 'approved' && !comment) throw ApiError.badRequest('A reason is required when rejecting or requesting revision');

  const approval = await Approval.findOne({ task: task._id, decision: 'pending' }).sort('-round');
  if (!approval) throw ApiError.badRequest('No pending submission found');
  approval.decision = decision;
  approval.reviewer = req.user._id;
  approval.reviewerComment = comment;
  approval.decidedAt = new Date();
  await approval.save();

  if (decision === 'approved') { task.status = 'completed'; task.completedAt = new Date(); task.progress = 100; }
  else if (decision === 'rejected') task.status = 'rejected';
  else task.status = 'revision_required';
  task.updatedBy = req.user._id;
  await task.save();

  const activityType = decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'revision_requested';
  await logActivity(task._id, req.user._id, activityType, `${activityType.replace('_', ' ')} submission (round ${approval.round})${comment ? `: ${comment}` : ''}`, { approval: approval._id, decision });

  await notify({
    recipients: participantIds(task),
    actor: req.user._id,
    type: decision === 'approved' ? 'task_completed' : 'approval_decided',
    title: `${task.taskId} ${decision.replace('_', ' ')}`,
    message: `${req.user.name} ${decision.replace('_', ' ')} "${task.title}".${comment ? ` Comment: ${comment}` : ''}`,
    entityType: 'task',
    entityId: task._id,
    link: `/tasks/${task._id}`,
  });

  await task.populate(TASK_POPULATE);
  emitToDepartment(task.department._id || task.department, 'task:updated', task.toJSON());
  emitToTask(task._id, 'task:updated', task.toJSON());
  return { task, approval };
}

export async function approvalHistory(req, id) {
  await loadTask(id, req, { lean: true });
  return Approval.find({ task: id }).sort('-round').populate('submittedBy', 'name avatar').populate('reviewer', 'name avatar').populate('deliverables').lean();
}
