-- ====================================================================
-- CLEAR ROAD — 001: enums
--
-- PostgreSQL enums instead of free text. Types are the shared vocabulary
-- between the database, the PostgREST API and the TypeScript application
-- (see src/types/index.ts — keep the two lists in sync).
-- ====================================================================

set search_path = public, extensions;

create type public.report_category as enum (
  'police_presence',
  'checkpoint_roadblock',
  'accident',
  'heavy_traffic',
  'flooded_road',
  'road_hazard'
);

-- Lifecycle is TIME-based: how relevant the report is right now.
create type public.report_lifecycle as enum (
  'NEW',     -- just created, uncorroborated
  'ACTIVE',  -- corroborated, still recent
  'RECENT',  -- uncorroborated but within its lifetime
  'STALE',   -- leaving the live product; closable
  'CLOSED'   -- removed from the live product
);

-- Confidence is EVIDENCE-based: independent corroboration, separate axis.
create type public.report_confidence as enum (
  'UNCONFIRMED',
  'LOW',
  'MEDIUM',
  'HIGH'
);

create type public.confirmation_signal as enum (
  'STILL_DEY',
  'DON_CLEAR'
);

create type public.report_event_type as enum (
  'REPORT_CREATED',
  'CONFIRMATION_ADDED',
  'DON_CLEAR_ADDED',
  'MESSAGE_POSTED',
  'LIFECYCLE_CHANGED',
  'REPORT_CLOSED',
  'REPORT_REOPENED',
  'MODERATION_CHANGED'
);

create type public.report_close_reason as enum (
  'DON_CLEAR',
  'EXPIRED',
  'MODERATED',
  'SUNRISE_RESET'
);

create type public.moderation_target as enum (
  'REPORT',
  'MESSAGE'
);

create type public.moderation_reason as enum (
  'SPAM',
  'HARASSMENT',
  'PERSONAL_INFORMATION',
  'DANGEROUS_CONTENT',
  'FALSE_REPORT',
  'ABUSE_OF_ANONYMITY',
  'OTHER'
);

create type public.moderation_status as enum (
  'OPEN',
  'REVIEWED',
  'DISMISSED',
  'ACTIONED'
);

create type public.message_moderation_state as enum (
  'VISIBLE',
  'HIDDEN',
  'REMOVED'
);