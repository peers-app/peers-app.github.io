# Group Invitations

This guide explains how to invite new members to a group using the password-based invitation system.

## Overview

The group invitation system allows group admins to invite new members without requiring a central server. It works by:

1. Admin generates or enters a password and starts "listening" for join requests
2. New member enters the same password to discover available groups
3. New member sends a join request
4. Admin approves or denies the request
5. If approved, the new member receives the group data and becomes a member

## For Admins: Inviting New Members

### Step 1: Open Group Settings

Navigate to your group and open the Members tab. You'll see an "Invite New Members" section if you have Admin privileges.

### Step 2: Set a Password

You can either:
- Click the shuffle button to generate a random memorable password (e.g., "apple-banana-cherry-date")
- Enter your own password (minimum 4 characters)

### Step 3: Start Listening

Click "Start Listening" to begin accepting join requests. Share the password with the people you want to invite through a secure channel (in person, phone call, secure messaging, etc.).

**Important:** 
- Listening automatically stops after 10 minutes for security
- You can stop listening manually at any time
- Stay on the page to see incoming requests

### Step 4: Approve Requests

When someone enters the password and sends a join request:
1. You'll see their name and user ID in the "Pending Requests" section
2. Select a role for them (Reader, Writer, or Admin)
3. Click "Approve" to add them to the group, or the X button to deny

## For New Members: Joining a Group

### Step 1: Open Join Group

Navigate to "Join Group" from the app menu or use the direct link.

### Step 2: Enter Password

Enter the invitation password that the group admin shared with you.

### Step 3: Search

Click "Search" to find groups using that password. If someone is actively listening with that password, you'll see the group information.

### Step 4: Join

Click "Join" to send your request to the admin. You'll see:
- "Waiting for approval..." while the admin reviews your request
- "Successfully Joined!" when approved (you'll be redirected to the group)
- An error message if denied or timed out

## Security Notes

- **Password strength:** The password is used to encrypt all communication during the invitation process. Use a strong password, especially for sensitive groups.
- **Time-limited:** Invitation listening expires after 10 minutes automatically.
- **No central server:** The invitation process happens directly between devices over the peer-to-peer network.
- **Verification:** The admin sees the requesting user's name and ID, allowing them to verify the person's identity before approving.

## Troubleshooting

### "No groups found with that password"
- Make sure the admin is actively listening (has clicked "Start Listening")
- Verify you've entered the password exactly as given
- Check that both devices are connected to the network

### "Request timed out"
- The admin may have stopped listening
- Try again and ask the admin to approve quickly
- The admin has 5 minutes to approve before the request times out

### Join succeeded but group doesn't appear
- The group data syncs automatically
- Try refreshing or waiting a moment for sync to complete
