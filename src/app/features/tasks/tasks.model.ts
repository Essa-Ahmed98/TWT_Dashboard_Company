import { PaginatedResult } from '../../core/models/api.models';

export enum TaskCategory {
  General = 0,
  HealthCheckup = 1,
  Health = 2,
  Meals = 3,
  Transportation = 4,
  Logistics = 5,
  Reports = 6,
}

/** status of a single task (for display) */
export enum TaskSupervisorStatus {
  Pending = 0,
  Completed = 1,
}

/** `statusFilter` query values of GET SupervisorTasks/assigned (backend TaskStatusFilter) */
export enum TaskStatusFilter {
  All = 0,
  Completed = 1,
  Pending = 2,
}

export interface SupervisorTaskItem {
  Id: string;
  SupervisorId: string;
  SupervisorName?: string;
  AssignedUserId?: string;
  AssignerId?: string;
  AssignerName?: string;
  Title: string;
  Description?: string;
  Category: TaskCategory;
  Status: TaskSupervisorStatus;
  DueDate: string;
  CreatedAt?: string;
  CompletedAt?: string | null;
}

export interface SupervisorTasksData {
  TotalCount?: number;
  PendingCount?: number;
  CompletedCount?: number;
  DelayedCount?: number;
  CompletionPercentage?: number;
  Tasks: PaginatedResult<SupervisorTaskItem>;
}

export interface SupervisorTasksQuery {
  pageNumber: number;
  pageSize: number;
  statusFilter?: TaskStatusFilter;
  search?: string;
  supervisorId?: string;
}

export interface AssignSupervisorTaskRequest {
  SupervisorId: string;
  Title: string;
  Description: string;
  Category: TaskCategory;
  DueDate: string;
}

export interface TaskForm {
  title: string;
  description: string;
  supervisorId: string;
  category: TaskCategory | '';
  dueDate: string | Date;
  dueTime: string;
}
