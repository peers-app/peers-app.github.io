# Group Sharing Implementation Plan

## Overview
This feature allows users to share groups through a JSON object containing group information and member data, enabling easy group sharing and onboarding of new users.

## Current State Analysis
- **group-list.tsx**: Uses ListScreen component with search and new group creation capability
- **group-details.tsx**: Has group info and members tabs, uses SaveButton component
- **package-list.tsx**: Shows example of add button with dropdown to the right of search
- **group-members.tsx**: Shows member management with roles (None=0, Reader=20, Writer=40, Admin=60, Owner=80, Founder=100)

## GroupShare Object Design

### Structure
```typescript
interface GroupShare {
  group: IGroup;                    // Core group information
  groupMembers: IGroupMember[];     // Members with admin role or above (Admin=60, Owner=80, Founder=100)
}
```

### Size Considerations for QR Code
- **QR Code limitations**: 
  - Version 10 (57x57): ~1,273 characters
  - Version 20 (97x97): ~3,057 characters
  - Version 40 (177x177): ~7,089 characters

- **Estimated size per group member**: ~150-200 characters (userId, role, signatures)
- **Group data**: ~200-300 characters (name, description, groupId, etc.)
- **Realistic capacity**: 10-20 admin+ members for Version 10, 30-40 for Version 20

**Recommendation**: Use Version 20 QR codes for most use cases, with fallback warning if data exceeds reasonable limits.

## Implementation Plan

### 1. Group Details Page - Share Button

**Location**: `peers-ui/src/screens/groups/group-details.tsx`

**Changes needed**:
- Add share button next to the SaveButton in header area (line 54-60)
- Implement `generateGroupShare()` function:
  - Get current group data
  - Query group members with role >= Admin (60)
  - Build GroupShare object
  - Convert to JSON string
  - Copy to clipboard
  - Show success/error feedback

**UI placement**: In the header div alongside the SaveButton

### 2. Group List Page - Import Button

**Location**: `peers-ui/src/screens/groups/group-list.tsx`

**Changes needed**:
- Add import button similar to package-list.tsx dropdown pattern
- Place button to the right of search in ListScreen component
- Implement `importGroupShare()` function:
  - Parse JSON from clipboard/user input
  - Validate GroupShare structure
  - Save group to user's userDataContext
  - Get/create group data context for the groupId
  - Save all provided admin+ members to the group context
  - Navigate to the new group

**UI approach**: Modify ListScreen component or add custom header with import functionality

### 3. Data Flow

**Share Process**:
1. User clicks share button on group-details page
2. System queries group and admin+ members
3. Creates GroupShare JSON object
4. Copies to clipboard
5. Shows success message with size info

**Import Process**:
1. User clicks import button on group-list page  
2. System prompts for JSON paste/input
3. Validates JSON structure
4. Saves group to user's groups table
5. Creates group data context
6. Saves member data as "seed" for device recognition
7. Redirects to group details page

### 4. Security & Validation

**Share validation**:
- Only allow sharing if current user has Admin+ role
- Include signature validation
- Limit member data to admin+ roles only

**Import validation**:
- Validate JSON structure matches GroupShare interface
- Verify group signatures
- Check for duplicate groups (warn user)
- Validate member data integrity

### 5. User Experience

**Feedback mechanisms**:
- Success notifications with data size info
- QR code size warnings if data is large
- Clear error messages for invalid imports
- Confirmation dialogs for imports

**Size optimization**:
- Strip unnecessary whitespace from JSON
- Consider compression for very large groups
- Warn users when approaching QR code limits

### 6. Technical Implementation Details

**New interfaces needed**:
```typescript
interface GroupShare {
  group: IGroup;
  groupMembers: IGroupMember[];
}
```

**Key functions to implement**:
- `generateGroupShare(groupId: string): Promise<GroupShare>`
- `importGroupShare(groupShareJson: string): Promise<void>`
- `validateGroupShare(groupShare: any): boolean`
- `estimateQRCodeSize(groupShare: GroupShare): number`

**Dependencies needed**:
- Clipboard API for copying/pasting
- JSON validation utilities
- QR code size estimation logic

### 7. Testing Considerations

**Test scenarios**:
- Share group with varying numbers of admin members
- Import shared group successfully
- Handle malformed JSON gracefully
- Validate permission checks work correctly
- Test with groups at QR code size limits
- Verify member seeding works for device recognition

**Edge cases**:
- Groups with no admin members
- Very large groups exceeding QR code capacity
- Network failures during import
- Duplicate group imports
- Invalid/corrupted share data

## Implementation Priority

1. **Phase 1**: Basic sharing functionality (share button, JSON generation)
2. **Phase 2**: Import functionality (import button, JSON parsing, group creation)
3. **Phase 3**: UX improvements (size warnings, better validation, progress indicators)
4. **Phase 4**: QR code integration and optimization features

## Files to Modify

1. `peers-ui/src/screens/groups/group-details.tsx` - Add share button and functionality
2. `peers-ui/src/screens/groups/group-list.tsx` - Add import button and functionality  
3. Potentially create new utility files for share/import logic
4. Update relevant type definitions if needed

This implementation will enable seamless group sharing while maintaining security and providing a good user experience within the constraints of QR code compatibility.