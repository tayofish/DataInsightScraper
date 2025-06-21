# Data Structure Guide

## Important: Table/Entity Renaming

This project underwent a major renaming of core entities. **Please always refer to this guide when working with the data structure.**

### Renaming Summary
- **Departments** → **Units** (smaller organizational units)
- **Categories** → **Departments** (larger organizational units containing multiple units)

### API Endpoint Mapping
| UI Page | Data Entity | API Endpoint | Database Table |
|---------|-------------|--------------|----------------|
| Units Page | Units (formerly Departments) | `/api/departments` | `departments` table |
| Departments Page | Departments (formerly Categories) | `/api/categories` | `categories` table |

### Database Schema
```
categories table → Now represents "Departments" in the UI
├── id: Primary key
├── name: Department name (e.g., "App Dev", "Testing")
├── color: Department color
├── departmentId: Reference to parent (nullable)
└── createdAt: Creation timestamp

departments table → Now represents "Units" in the UI  
├── id: Primary key
├── name: Unit name (e.g., "Database Unit", "Security Unit")
├── description: Unit description
├── departmentHeadId: Reference to user who heads this unit
└── createdAt: Creation timestamp
```

### Frontend Components
- **Units Page** (`/units`): Manages units (uses `/api/departments`)
- **Departments Page** (`/departments`): Manages departments (uses `/api/categories`)

### Key Points
1. **Units** are smaller organizational units (like teams)
2. **Departments** are larger organizational units that can contain multiple units
3. The API endpoints do NOT match the UI terminology due to the renaming
4. Always use the correct API endpoint based on the table above
5. Department heads manage units, not departments themselves

### Historical Context
This renaming was implemented to create a hierarchical organizational structure where:
- Departments are the top-level organizational units
- Units are sub-units within departments
- This allows for better organizational management and email notification hierarchies

**Last Updated:** June 21, 2025