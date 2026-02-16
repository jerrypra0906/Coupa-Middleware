# Coupa OAuth2 Authentication Setup

This document describes how to configure OAuth2 authentication for Coupa API access.

## Overview

The middleware supports two authentication methods for Coupa API:
1. **API Key Authentication** (Legacy) - Uses `X-COUPA-API-KEY` header
2. **OAuth2 Authentication** (Preferred) - Uses Bearer token with automatic refresh

If OAuth2 credentials are provided, the system will automatically use OAuth2 instead of API key.

## Configuration

Add the following environment variables to your `.env.staging` file (or `.env` for development):

```bash
# COUPA OAuth2 Configuration
COUPA_OAUTH_TOKEN_URL=https://kpn-test.coupahost.com/oauth2/token
COUPA_OAUTH_API_BASE_URL=https://kpn-test.coupahost.com
COUPA_OAUTH_CLIENT_ID=7d1c663c96949dbf75b1a88d4730a5a7
COUPA_OAUTH_CLIENT_SECRET=672cbb548968b0c2c66ee16b368d2fc6beb2a7a4f7895e04c829aee0e825f12d
COUPA_OAUTH_SCOPE=core.accounting.read core.accounting.write core.address.read_write core.approval.configuration.read core.approval.configuration.write core.approval.read core.approval.write core.budget.read core.budget.write core.business_entity.read core.business_entity.write core.business_groups.read_write core.catalog.read core.catalog.write core.commodity.read core.common.read core.common.write core.contract_party_role.read core.contract_party_role.write core.contract.read core.contract.write core.contracts_template.read core.contracts_template.write core.custom_objects.read_write core.data_table_view.write core.data_tables.read core.easy_form_response.approval.write core.easy_form_response.read core.easy_form_response.write core.easy_form.read core.easy_form.write core.estimated_tax.read core.estimated_tax.write core.expense.read core.expense.secure.read core.expense.secure.write core.expense.write core.financial_counterparty.read core.financial_counterparty.write core.global_navigation.read core.globalization.read core.integration.read core.integration.write core.inventory.adjustment.read core.inventory.adjustment.write core.inventory.asn.read core.inventory.asn.write core.inventory.balance.read core.inventory.common.read core.inventory.common.write core.inventory.consumption.read core.inventory.consumption.write core.inventory.cycle_counts.read core.inventory.cycle_counts.write core.inventory.pick_list.read core.inventory.pick_list.write core.inventory.receiving.read core.inventory.receiving.write core.inventory.return_to_supplier.read core.inventory.return_to_supplier.write core.inventory.transaction.read core.inventory.transfer.read core.inventory.transfer.write core.invoice.approval.bypass core.invoice.approval.write core.invoice.assignment.read core.invoice.assignment.write core.invoice.create core.invoice.delete core.invoice.read core.invoice.write core.item.read core.item.write core.items.flexible_attributes.read core.items.flexible_attributes.write core.legal_entity.read core.legal_entity.write core.lookups.read_write core.my_workbench.task.read core.notifications_summary.read core.notifications_summary.write core.object_translations.read core.object_translations.write core.order_header_confirmation.assignment.read core.order_header_confirmation.assignment.write core.order_header_confirmations.read core.order_header_confirmations.write core.order_pad.read core.order_pad.write core.pay.charges.read core.pay.charges.write core.pay.payment_accounts.read core.pay.payments.read core.pay.payments.write core.pay.statements.read core.pay.statements.write core.pay.virtual_cards.read core.pay.virtual_cards.write core.payables.allocations.read core.payables.allocations.write core.payables.expense.read core.payables.expense.write core.payables.external.read core.payables.external.write core.payables.invoice.read core.payables.invoice.write core.payables.order.read core.payables.order.write core.project.read core.project.write core.punchout_site.read core.punchout_site.write core.purchase_order_change.assignment.read core.purchase_order_change.assignment.write core.purchase_order_change.read core.purchase_order_change.write core.purchase_order_only.read core.purchase_order_only.write core.purchase_order.assignment.read core.purchase_order.assignment.write core.purchase_order.read core.purchase_order.write core.requisition.assignment.read core.requisition.assignment.write core.requisition.read core.requisition.write core.roles.read_write core.sourcing.bom.read core.sourcing.pending_supplier.read core.sourcing.pending_supplier.write core.sourcing.read core.sourcing.response.award.write core.sourcing.response.read core.sourcing.response.write core.sourcing.write core.supplier_information_sites.read core.supplier_information_sites.write core.supplier_information_tax_registrations.delete core.supplier_information_tax_registrations.read core.supplier_information_tax_registrations.write core.supplier_sharing_settings.read core.supplier_sharing_settings.write core.supplier_sites.read core.supplier_sites.write core.supplier.read core.supplier.risk_aware.read core.supplier.risk_aware.write core.supplier.write core.swap.write core.translation.read core.translation.write core.unmanaged_spend.read core.uom.read core.uom.write core.user_group.read core.user_group.write core.user_recent_activity.read core.user.read core.user.write core.webhooks.read core.webhooks.write core.write_a_request.read email login offline_access openid profile quality_collaboration.quality_inspection.read quality_collaboration.quality_inspection.write
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `COUPA_OAUTH_TOKEN_URL` | OAuth2 token endpoint URL | Yes | `https://kpn-test.coupahost.com/oauth2/token` |
| `COUPA_OAUTH_API_BASE_URL` | Base URL for Coupa API calls | Yes | `https://kpn-test.coupahost.com` |
| `COUPA_OAUTH_CLIENT_ID` | OAuth2 client ID (username) | Yes | - |
| `COUPA_OAUTH_CLIENT_SECRET` | OAuth2 client secret (password) | Yes | - |
| `COUPA_OAUTH_SCOPE` | OAuth2 scopes (space-separated) | No | - |

## How It Works

1. **Token Acquisition**: When the first API call is made, the system requests an access token from the OAuth2 endpoint using Basic Authentication (client_id:client_secret).

2. **Token Caching**: The access token is cached in memory and reused for subsequent requests until it expires.

3. **Automatic Refresh**: 
   - Tokens are automatically refreshed 60 seconds before expiration
   - If a 401 (Unauthorized) error is received, the token is automatically refreshed and the request is retried

4. **Request Interceptor**: All API requests automatically include the Bearer token in the Authorization header.

## Testing

To test the OAuth2 configuration, you can run the test script:

```bash
# From the backend directory
node src/scripts/testCoupaOAuth.js
```

Or test via Docker:

```bash
docker exec coupa_backend node src/scripts/testCoupaOAuth.js
```

## Migration from API Key

If you're currently using API key authentication and want to migrate to OAuth2:

1. Add the OAuth2 environment variables to your `.env.staging` file
2. Restart the backend service
3. The system will automatically use OAuth2 if both `COUPA_OAUTH_CLIENT_ID` and `COUPA_OAUTH_CLIENT_SECRET` are set
4. You can keep the API key variables for backward compatibility, but they will be ignored when OAuth2 is configured

## Troubleshooting

### Token Request Fails
- Verify `COUPA_OAUTH_CLIENT_ID` and `COUPA_OAUTH_CLIENT_SECRET` are correct
- Check that `COUPA_OAUTH_TOKEN_URL` is accessible from your server
- Review logs for detailed error messages

### 401 Unauthorized Errors
- The system will automatically retry with a fresh token
- If errors persist, verify the scopes in `COUPA_OAUTH_SCOPE` include the required permissions

### Token Not Refreshing
- Check logs for token refresh errors
- Verify the token endpoint is responding correctly
- Ensure the client credentials are still valid

