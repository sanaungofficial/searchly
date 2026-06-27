-- Admin queue for in-network intro and send-profile requests

CREATE TYPE "NetworkJobRequestType" AS ENUM ('INTRO', 'SEND_PROFILE');
CREATE TYPE "NetworkJobRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "NetworkJobRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobSource" "NetworkJobSource" NOT NULL,
  "jobExternalId" TEXT NOT NULL,
  "requestType" "NetworkJobRequestType" NOT NULL,
  "status" "NetworkJobRequestStatus" NOT NULL DEFAULT 'PENDING',
  "jobTitle" TEXT NOT NULL,
  "companyName" TEXT,
  "channelCode" TEXT,
  "recruiterName" TEXT,
  "clientNotes" TEXT,
  "adminNotes" TEXT,
  "handledByUserId" TEXT,
  "handledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NetworkJobRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NetworkJobRequest_status_createdAt_idx" ON "NetworkJobRequest"("status", "createdAt");
CREATE INDEX "NetworkJobRequest_userId_jobExternalId_requestType_idx" ON "NetworkJobRequest"("userId", "jobExternalId", "requestType");
CREATE INDEX "NetworkJobRequest_jobSource_jobExternalId_idx" ON "NetworkJobRequest"("jobSource", "jobExternalId");

ALTER TABLE "NetworkJobRequest" ADD CONSTRAINT "NetworkJobRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
