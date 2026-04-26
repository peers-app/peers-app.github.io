# Azure Code Signing Troubleshooting

## Current Status: ✅ RESOLVED

**Issue:** `Status: 403 (Forbidden)` - FIXED on 2025-10-28

The service principal "Peers Electron Code Signing" now has the required permissions.

## Problem Summary

### What Was Working ✅
1. **Azure Account**: Connected as `mark_archer@live.com`
2. **Subscription**: `uboinc` (f68ee2c1-9d6a-4690-a79c-980ce97c3c68)
3. **Code Signing Account**: `peers-electron-signing` exists in `peers-services` resource group
4. **Your Personal Permissions**: You have both required roles:
   - ✅ Trusted Signing Identity Verifier
   - ✅ Trusted Signing Certificate Profile Signer

### What Was Broken (NOW FIXED) ✅
**The service principal used by GitHub Actions didn't have permissions - NOW GRANTED**

Service Principal: **Peers Electron Code Signing**
- `AZURE_TENANT_ID`: `ccd36e1c-82d1-42ec-997c-880071cdbe0d`
- `AZURE_CLIENT_ID`: `4d689c02-18e8-4b41-9b8d-c7a03a8119ee`
- `Object ID`: `f802b1b4-49da-4439-80f2-6ff7c14ae33c`

## Resource Details

### Code Signing Account
- **Name**: `peers-electron-signing`
- **Resource Group**: `peers-services`
- **Location**: `westus2`
- **Full Resource ID**:
  ```
  /subscriptions/f68ee2c1-9d6a-4690-a79c-980ce97c3c68/resourceGroups/peers-services/providers/Microsoft.CodeSigning/codeSigningAccounts/peers-electron-signing
  ```

### Current Role Assignments ✅

**Service Principal (GitHub Actions):**
```
Principal: Peers Electron Code Signing
App ID: 4d689c02-18e8-4b41-9b8d-c7a03a8119ee
Object ID: f802b1b4-49da-4439-80f2-6ff7c14ae33c
Roles:
  ✅ Trusted Signing Certificate Profile Signer
  ✅ Trusted Signing Identity Verifier
```

**Personal Account:**
```
Principal: Mark_Archer_live.com#EXT#@MarkArcherlive.onmicrosoft.com
Principal ID: 63b26f54-7ca8-4aec-8bd4-6e756370feb8
Roles:
  ✅ Trusted Signing Identity Verifier
  ✅ Trusted Signing Certificate Profile Signer
  ✅ Reader (subscription level)
```

## Solution Options

### Option 1: Find and Fix Existing Service Principal (Recommended)
If you already created a service principal for GitHub Actions:

1. **Find the service principal used in your GitHub secrets:**
   ```bash
   # Check your GitHub repo secrets for AZURE_CLIENT_ID
   # Then look it up:
   az ad sp show --id YOUR_AZURE_CLIENT_ID
   ```

2. **Grant the required permissions:**
   ```bash
   # Replace YOUR_SERVICE_PRINCIPAL_ID with the objectId from step 1

   # Grant "Trusted Signing Certificate Profile Signer" role
   az role assignment create \
     --role "Trusted Signing Certificate Profile Signer" \
     --assignee YOUR_SERVICE_PRINCIPAL_ID \
     --scope "/subscriptions/f68ee2c1-9d6a-4690-a79c-980ce97c3c68/resourceGroups/peers-services/providers/Microsoft.CodeSigning/codeSigningAccounts/peers-electron-signing"

   # Grant "Trusted Signing Identity Verifier" role
   az role assignment create \
     --role "Trusted Signing Identity Verifier" \
     --assignee YOUR_SERVICE_PRINCIPAL_ID \
     --scope "/subscriptions/f68ee2c1-9d6a-4690-a79c-980ce97c3c68/resourceGroups/peers-services/providers/Microsoft.CodeSigning/codeSigningAccounts/peers-electron-signing"
   ```

### Option 2: Create New Service Principal
If you need to create a new service principal from scratch:

1. **Create the service principal:**
   ```bash
   az ad sp create-for-rbac \
     --name "peers-electron-github-signing" \
     --role "Trusted Signing Certificate Profile Signer" \
     --scopes "/subscriptions/f68ee2c1-9d6a-4690-a79c-980ce97c3c68/resourceGroups/peers-services/providers/Microsoft.CodeSigning/codeSigningAccounts/peers-electron-signing" \
     --sdk-auth
   ```

   **Save the output!** You'll need:
   - `clientId` → GitHub secret `AZURE_CLIENT_ID`
   - `clientSecret` → GitHub secret `AZURE_CLIENT_SECRET`
   - `tenantId` → GitHub secret `AZURE_TENANT_ID`

2. **Add the second required role:**
   ```bash
   az role assignment create \
     --role "Trusted Signing Identity Verifier" \
     --assignee YOUR_NEW_CLIENT_ID \
     --scope "/subscriptions/f68ee2c1-9d6a-4690-a79c-980ce97c3c68/resourceGroups/peers-services/providers/Microsoft.CodeSigning/codeSigningAccounts/peers-electron-signing"
   ```

3. **Update GitHub Secrets:**
   - Go to: https://github.com/YOUR_ORG/peers-electron/settings/secrets/actions
   - Update or create:
     - `AZURE_CLIENT_ID`
     - `AZURE_CLIENT_SECRET`
     - `AZURE_TENANT_ID`

## Required Roles Explained

### Trusted Signing Certificate Profile Signer
- **Purpose**: Allows signing files with certificate profiles
- **Role ID**: `2837e146-70d7-4cfd-ad55-7efa6464f958`
- **Required**: ✅ Yes

### Trusted Signing Identity Verifier
- **Purpose**: Verifies identity for signing operations
- **Role ID**: `4339b7cf-9826-4e41-b4ed-c7f4505dac08`
- **Required**: ✅ Yes

## Verification Commands

After fixing permissions, verify with:

```bash
# Check role assignments
az role assignment list \
  --scope "/subscriptions/f68ee2c1-9d6a-4690-a79c-980ce97c3c68/resourceGroups/peers-services/providers/Microsoft.CodeSigning/codeSigningAccounts/peers-electron-signing" \
  --output table

# List certificate profiles (requires trustedsigning extension)
az codesigning certificate-profile list \
  --account-name peers-electron-signing \
  --resource-group peers-services \
  --output table

# Test service principal login
az login --service-principal \
  --username YOUR_AZURE_CLIENT_ID \
  --password YOUR_AZURE_CLIENT_SECRET \
  --tenant YOUR_AZURE_TENANT_ID
```

## GitHub Workflow Configuration

Your workflow at `.github/workflows/build-and-release.yml` uses:

```yaml
- name: Sign Windows files with Trusted Signing
  uses: azure/trusted-signing-action@v0
  with:
    azure-tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    azure-client-id: ${{ secrets.AZURE_CLIENT_ID }}
    azure-client-secret: ${{ secrets.AZURE_CLIENT_SECRET }}
    endpoint: ${{ secrets.AZURE_SIGN_ENDPOINT }}
    trusted-signing-account-name: ${{ secrets.AZURE_CODE_SIGNING_ACCOUNT_NAME }}
    certificate-profile-name: ${{ secrets.AZURE_CERTIFICATE_PROFILE_NAME }}
```

### Required GitHub Secrets
Verify all these are set:
- ✅ `AZURE_TENANT_ID`: `ccd36e1c-82d1-42ec-997c-880071cdbe0d`
- ❓ `AZURE_CLIENT_ID`: **NEEDS PERMISSIONS**
- ❓ `AZURE_CLIENT_SECRET`: (must match CLIENT_ID)
- ❓ `AZURE_SIGN_ENDPOINT`: Should be like `https://xxx.codesigning.azure.net`
- ❓ `AZURE_CODE_SIGNING_ACCOUNT_NAME`: Should be `peers-electron-signing`
- ❓ `AZURE_CERTIFICATE_PROFILE_NAME`: (check what profiles exist)

## Resolution Steps (COMPLETED)

1. ✅ **Diagnose** - Identified service principal lacking permissions
2. ✅ **Found service principal** - "Peers Electron Code Signing" (4d689c02-18e8-4b41-9b8d-c7a03a8119ee)
3. ✅ **Grant permissions** - Assigned both required roles via Azure Portal
4. ✅ **Verify permissions** - Confirmed roles are active

## Next Steps (TESTING)

1. ⬜ **Verify GitHub secrets** - Ensure all secrets are correct (see below)
2. ⬜ **Test** - Trigger a workflow run to test signing
3. ⬜ **Verify** - Check that signing succeeds without 403 error

## Error Reference

From `signing-results.md`:
```
Azure.RequestFailedException: Service request failed.
Status: 403 (Forbidden)
```

**Root Cause**: Service principal lacks role assignments on the code signing account.

**Solution**: Assign roles per Option 1 or 2 above.

## Additional Resources

- [Azure Trusted Signing Documentation](https://learn.microsoft.com/azure/trusted-signing/)
- [GitHub Action: azure/trusted-signing-action](https://github.com/azure/trusted-signing-action)
- [Role-Based Access Control (RBAC)](https://learn.microsoft.com/azure/role-based-access-control/)

---

**Last Updated**: 2025-10-28
**Status**: ✅ RESOLVED - Permissions granted, ready for testing
**Action Taken**: Granted both required roles to "Peers Electron Code Signing" service principal via Azure Portal
