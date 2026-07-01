import type { InboxContactSource, JobStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  dbStatusesForCanonical,
  isInboxContactStatus,
  normalizeContactStatus,
} from "@/lib/inbox-crm/contact-status";

export type ContactSortField =
  | "name"
  | "email"
  | "company"
  | "status"
  | "updatedAt"
  | "createdAt"
  | "lastActivityAt";

export type ContactFilterOperator = "eq" | "contains" | "gte" | "lte" | "is_true" | "is_false" | "in";

export type ContactListFilter = {
  category: "contact" | "activity" | "opportunity";
  field: string;
  operator: ContactFilterOperator;
  value?: string | string[];
};

export type ListContactsParams = {
  userId: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: ContactSortField;
  sortDir?: "asc" | "desc";
  filters?: ContactListFilter[];
};

export type ContactListRow = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  title: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  contacted: boolean | null;
  source: InboxContactSource;
  status: string | null;
  statusUpdatedAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  savedToNylas: boolean;
  activityCount: number;
  lastActivity: {
    id: string;
    subject: string | null;
    occurredAt: string | null;
    direction: string;
    kind: string;
  } | null;
  linkedJobs: { id: string; company: string; role: string; stage: string; contactRole: string | null }[];
};

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

function buildFilterWhere(filters: ContactListFilter[]): Prisma.InboxContactWhereInput[] {
  const clauses: Prisma.InboxContactWhereInput[] = [];

  for (const f of filters) {
    if (f.category === "contact") {
      if (f.field === "status" && f.operator === "eq" && typeof f.value === "string") {
        if (isInboxContactStatus(f.value)) {
          clauses.push({ status: { in: dbStatusesForCanonical(f.value) } });
        } else {
          clauses.push({ status: f.value });
        }
      }
      if (f.field === "status" && f.operator === "in" && Array.isArray(f.value)) {
        const expanded = f.value.flatMap((v) =>
          typeof v === "string" && isInboxContactStatus(v) ? dbStatusesForCanonical(v) : v,
        );
        clauses.push({ status: { in: expanded } });
      }
      if (f.field === "source" && f.operator === "eq" && typeof f.value === "string") {
        clauses.push({ source: f.value as InboxContactSource });
      }
      if (f.field === "source" && f.operator === "in" && Array.isArray(f.value)) {
        clauses.push({ source: { in: f.value as InboxContactSource[] } });
      }
      if (f.field === "contacted" && f.operator === "is_true") clauses.push({ contacted: true });
      if (f.field === "contacted" && f.operator === "is_false") clauses.push({ contacted: false });
      if (f.field === "name" && f.operator === "contains" && typeof f.value === "string") {
        clauses.push({ name: { contains: f.value, mode: "insensitive" } });
      }
      if (f.field === "email" && f.operator === "contains" && typeof f.value === "string") {
        clauses.push({ email: { contains: f.value, mode: "insensitive" } });
      }
      if (f.field === "company" && f.operator === "contains" && typeof f.value === "string") {
        clauses.push({ company: { contains: f.value, mode: "insensitive" } });
      }
      if (f.field === "title" && f.operator === "contains" && typeof f.value === "string") {
        clauses.push({ title: { contains: f.value, mode: "insensitive" } });
      }
      if (f.field === "hasLinkedJob" && f.operator === "is_true") {
        clauses.push({ jobLinks: { some: {} } });
      }
      if (f.field === "hasLinkedJob" && f.operator === "is_false") {
        clauses.push({ jobLinks: { none: {} } });
      }
      if (f.field === "createdAt" && f.operator === "gte" && typeof f.value === "string") {
        clauses.push({ createdAt: { gte: new Date(f.value) } });
      }
      if (f.field === "createdAt" && f.operator === "lte" && typeof f.value === "string") {
        clauses.push({ createdAt: { lte: new Date(f.value) } });
      }
      if (f.field === "updatedAt" && f.operator === "gte" && typeof f.value === "string") {
        clauses.push({ updatedAt: { gte: new Date(f.value) } });
      }
      if (f.field === "updatedAt" && f.operator === "lte" && typeof f.value === "string") {
        clauses.push({ updatedAt: { lte: new Date(f.value) } });
      }
    }

    if (f.category === "activity") {
      if (f.field === "lastActivityAt" && f.operator === "gte" && typeof f.value === "string") {
        clauses.push({ lastActivityAt: { gte: new Date(f.value) } });
      }
      if (f.field === "lastActivityAt" && f.operator === "lte" && typeof f.value === "string") {
        clauses.push({ lastActivityAt: { lte: new Date(f.value) } });
      }
      if (f.field === "hasEmail" && f.operator === "is_true") {
        clauses.push({ activities: { some: { kind: "EMAIL" } } });
      }
      if (f.field === "hasMeeting" && f.operator === "is_true") {
        clauses.push({ activities: { some: { kind: "MEETING" } } });
      }
      if (f.field === "activityTag" && f.operator === "eq" && typeof f.value === "string") {
        clauses.push({ activities: { some: { userTag: f.value } } });
      }
    }

    if (f.category === "opportunity") {
      if (f.field === "jobStage" && f.operator === "eq" && typeof f.value === "string") {
        clauses.push({ jobLinks: { some: { job: { stage: f.value as JobStage } } } });
      }
      if (f.field === "jobCompany" && f.operator === "contains" && typeof f.value === "string") {
        clauses.push({ jobLinks: { some: { job: { company: { contains: f.value, mode: "insensitive" } } } } });
      }
    }
  }

  return clauses;
}

function orderByForSort(sort: ContactSortField, sortDir: "asc" | "desc"): Prisma.InboxContactOrderByWithRelationInput {
  if (sort === "name") {
    return { name: sortDir };
  }
  if (sort === "email") return { email: sortDir };
  if (sort === "company") return { company: sortDir };
  if (sort === "status") return { status: sortDir };
  if (sort === "createdAt") return { createdAt: sortDir };
  if (sort === "lastActivityAt") return { lastActivityAt: sortDir };
  return { updatedAt: sortDir };
}

export function parseContactListFilters(raw: string | null): ContactListFilter[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as ContactListFilter[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f) =>
        f &&
        typeof f.category === "string" &&
        typeof f.field === "string" &&
        typeof f.operator === "string",
    );
  } catch {
    return [];
  }
}

export async function listInboxContacts(params: ListContactsParams) {
  const pageSize = Math.min(Math.max(params.pageSize ?? PAGE_SIZE_DEFAULT, 1), PAGE_SIZE_MAX);
  const page = Math.max(params.page ?? 1, 1);
  const skip = (page - 1) * pageSize;
  const sort = params.sort ?? "updatedAt";
  const sortDir = params.sortDir === "asc" ? "asc" : "desc";
  const q = params.q?.trim().toLowerCase();
  const filterClauses = buildFilterWhere(params.filters ?? []);

  const where: Prisma.InboxContactWhereInput = {
    userId: params.userId,
    AND: [
      ...(q
        ? [
            {
              OR: [
                { email: { contains: q, mode: "insensitive" as const } },
                { name: { contains: q, mode: "insensitive" as const } },
                { company: { contains: q, mode: "insensitive" as const } },
                { title: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
      ...filterClauses,
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.inboxContact.count({ where }),
    prisma.inboxContact.findMany({
      where,
      orderBy: orderByForSort(sort, sortDir),
      skip,
      take: pageSize,
      include: {
        jobLinks: {
          include: { job: { select: { id: true, company: true, role: true, stage: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        activities: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: { id: true, subject: true, occurredAt: true, direction: true, kind: true },
        },
        _count: { select: { activities: true } },
      },
    }),
  ]);

  const contacts: ContactListRow[] = rows.map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name,
    company: c.company,
    title: c.title,
    phone: c.phone,
    linkedinUrl: c.linkedinUrl,
    notes: c.notes,
    contacted: c.contacted,
    source: c.source,
    status: normalizeContactStatus(c.status),
    statusUpdatedAt: c.statusUpdatedAt?.toISOString() ?? null,
    lastActivityAt: c.lastActivityAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    savedToNylas: Boolean(c.nylasContactId),
    activityCount: c._count.activities,
    lastActivity: c.activities[0]
      ? {
          id: c.activities[0].id,
          subject: c.activities[0].subject,
          occurredAt: c.activities[0].occurredAt?.toISOString() ?? null,
          direction: c.activities[0].direction,
          kind: c.activities[0].kind,
        }
      : null,
    linkedJobs: c.jobLinks.map((l) => ({
      ...l.job,
      contactRole: l.role,
    })),
  }));

  return {
    contacts,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function parseContactSortField(raw: string | null): ContactSortField {
  const allowed: ContactSortField[] = [
    "name",
    "email",
    "company",
    "status",
    "updatedAt",
    "createdAt",
    "lastActivityAt",
  ];
  if (raw && allowed.includes(raw as ContactSortField)) return raw as ContactSortField;
  return "updatedAt";
}

export { isInboxContactStatus };
