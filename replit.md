# Promellon Task Management System

## Overview

Promellon is a comprehensive task management and collaboration platform designed for organizational efficiency. It features user authentication, task management, department hierarchy, email notifications, and real-time collaboration capabilities. The system is production-ready with extensive database schema, WebSocket support, and deployment configurations.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for development and production builds
- **UI Framework**: Radix UI components with Tailwind CSS
- **State Management**: TanStack Query for server state management
- **Real-time Updates**: WebSocket client for live messaging and notifications

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript for type safety
- **Authentication**: Passport.js with local and Microsoft Azure AD strategies
- **Session Management**: PostgreSQL-backed session store
- **File Handling**: Multer for file uploads (10MB limit)
- **Real-time Communication**: WebSocket server for live updates

## Key Components

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL
- **Schema**: Comprehensive schema with proper relationships and constraints
- **Migration System**: SQL-based migrations with production deployment scripts
- **Data Validation**: Zod schemas for runtime type checking

### Authentication System
- **Local Authentication**: Username/password with bcrypt hashing
- **Microsoft OAuth**: Azure AD integration for enterprise authentication
- **Authorization**: Role-based access control (admin/user roles)
- **Session Security**: Secure session management with PostgreSQL storage

### Task Management
- **Hierarchical Organization**: Categories (Departments) → Departments (Units) structure
- **Task Features**: Priority levels, status tracking, assignments, collaborators
- **Project Management**: Project-based task organization with team assignments
- **Progress Tracking**: Task updates, comments, and activity logging

### Communication Features
- **Real-time Messaging**: WebSocket-powered chat system
- **Channel Management**: Public/private channels with member management
- **Direct Messaging**: One-on-one conversations with file sharing
- **Mention System**: @mention functionality with notification triggers

### Notification System
- **Email Notifications**: SMTP-configurable email alerts
- **In-app Notifications**: Real-time notification feed
- **Scheduled Notifications**: End-of-day summary emails with cron scheduling
- **Role-based Targeting**: Different notification types for admins and unit heads

## Data Flow

### Request Processing
1. Client requests hit Express middleware stack
2. Authentication middleware validates sessions
3. Route handlers process business logic
4. Database operations via Drizzle ORM
5. WebSocket broadcasts for real-time updates
6. Response formatting and error handling

### WebSocket Communication
1. Client connects to `/ws` endpoint
2. Server maintains connection registry with user mapping
3. Real-time events broadcast to relevant connected clients
4. Fallback handling for offline scenarios

### Email Workflow
1. Trigger events (task assignments, mentions, daily summaries)
2. Template rendering with user-specific data
3. SMTP delivery via configured email service
4. Delivery status tracking and retry logic

## External Dependencies

### Core Dependencies
- **Database**: PostgreSQL 12+ with connection pooling
- **Email Service**: SMTP server (Zeptomail, SendGrid, or custom)
- **File Storage**: Local filesystem with configurable upload directory
- **WebSocket**: Built-in WebSocket server with nginx proxy support

### Production Infrastructure
- **Reverse Proxy**: Nginx with WebSocket upgrade support
- **Process Manager**: PM2 for application clustering and monitoring
- **Session Store**: PostgreSQL-backed session management
- **SSL/TLS**: HTTPS certificate handling via nginx

## Deployment Strategy

### Environment Configuration
- **Development**: Vite dev server with hot reload
- **Production**: Static file serving with optimized builds
- **Database**: Connection string-based configuration
- **Secrets**: Environment variable management for sensitive data

### Production Deployment
1. **Database Migration**: Execute `production_deployment_schema.sql`
2. **Application Build**: `npm run build` for optimized frontend
3. **Process Management**: PM2 configuration with clustering
4. **Nginx Configuration**: WebSocket proxy and static file serving
5. **SSL Setup**: Certificate installation and HTTPS redirection

### Monitoring and Maintenance
- **Health Checks**: `/api/health` endpoint for system status
- **Database Monitoring**: Connection pool and query performance tracking
- **Email Service**: SMTP configuration validation and delivery monitoring
- **File Management**: Upload directory monitoring and cleanup

## Changelog

- June 24, 2025: Fixed combobox component with reliable click functionality and selection handling
- June 24, 2025: Added searchable dropdowns to calendar modal for all fields (unit, department, event type, users)
- June 24, 2025: Added invite users feature to calendar modal with attendee selection and management
- June 24, 2025: Fixed calendar modal labels - Units are called Departments, Categories are called Units
- June 24, 2025: Enhanced Calendar modal with responsive design and vertical scroll
- June 24, 2025: Moved Calendar menu between Projects and Reports
- June 24, 2025: Fixed calendar database query issues for user events and reminders
- June 24, 2025: Implemented comprehensive Calendar feature with email notifications
- June 24, 2025: Fixed unit deletion bug in frontend routing
- June 24, 2025: Disabled debug logging for mention extraction functionality
- June 23, 2025: Fixed overdue task calculation bug in admin insights API
- June 23, 2025: Added "Overdue" filter option to task status dropdown
- June 23, 2025: Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.