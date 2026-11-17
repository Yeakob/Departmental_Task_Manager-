import { useDispatch } from 'react-redux';
import { Plus } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import KanbanBoard from '@/features/kanban/KanbanBoard';
import { openTaskForm } from '@/store/uiSlice';

export default function Kanban() {
  const dispatch = useDispatch();
  return (
    <div>
      <PageHeader title="Kanban board" description="Drag cards between columns to update status. Everyone viewing the board sees changes immediately." actions={<Button onClick={() => dispatch(openTaskForm())}><Plus /> New task</Button>} />
      <KanbanBoard />
    </div>
  );
}
