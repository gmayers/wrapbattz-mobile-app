# Stripe Backend Integration Requirements

## Overview
This document outlines the required backend endpoints and Stripe integration for the WrapBattz billing system.

## Key Concepts

### 1. Device Counting & Billing Logic
- **Free Tier**: First 3 devices are always free
- **Billable Devices**: Total devices - 3 (minimum 0)
- **Pricing**: 
  - Monthly: £0.40 per device
  - Annual: £0.25 per device (38% savings)

### 2. Data Flow
```
App → Your Backend → Stripe API → Response → App
```

The app never directly calls Stripe's API. All Stripe operations go through your backend for security.

## Required API Endpoints

### 1. **GET /billing/status/**
Returns the current billing status and device counts.

**Response:**
```json
{
  "devices": {
    "total": 5,
    "active": 5,
    "inactive": 0,
    "free_quota": 3,
    "billable": 2
  },
  "tier": {
    "name": "1-100 Devices",
    "price_per_device": {
      "monthly": 0.40,
      "annual": 0.25
    }
  },
  "billing": {
    "status": "active", // active, inactive, past_due, cancelled
    "cycle": "monthly", // monthly or annual
    "free_quota": 3,
    "next_billing_date": "2024-02-15T00:00:00Z",
    "price_per_device": 0.40,
    "total_monthly_cost": 0.80
  },
  "customer": {
    "id": "cus_xxxxx", // Stripe customer ID
    "email": "user@example.com"
  }
}
```

### 2. **POST /billing/create-subscription-setup/**
Creates a Stripe subscription with SetupIntent for payment method collection.

**Request:**
```json
{
  "plan_type": "monthly", // or "annual"
  "device_count": 2
}
```

**Response:**
```json
{
  "setup_intent_client_secret": "seti_xxxxx_secret_xxxxx",
  "customer_id": "cus_xxxxx",
  "ephemeral_key_secret": "ek_xxxxx",
  "subscription_id": "sub_xxxxx"
}
```

**Backend Implementation:**
```python
# 1. Create or retrieve Stripe customer
customer = stripe.Customer.create(
    email=user.email,
    metadata={'user_id': user.id}
)

# 2. Create ephemeral key
ephemeral_key = stripe.EphemeralKey.create(
    customer=customer.id,
    stripe_version='2023-10-16'
)

# 3. Create subscription with trial (to not charge immediately)
subscription = stripe.Subscription.create(
    customer=customer.id,
    items=[{
        'price': price_id,  # Your price ID for monthly/annual
        'quantity': device_count
    }],
    payment_behavior='default_incomplete',
    payment_settings={'save_default_payment_method': 'on_subscription'},
    expand=['latest_invoice.payment_intent', 'pending_setup_intent']
)

# 4. Return setup intent from subscription
setup_intent = subscription.pending_setup_intent
```

### 3. **POST /billing/confirm-subscription/**
Confirms the subscription after payment method is attached.

**Request:**
```json
{
  "subscription_id": "sub_xxxxx"
}
```

**Backend Implementation:**
```python
# Update subscription to active
subscription = stripe.Subscription.modify(
    subscription_id,
    metadata={'confirmed': 'true'}
)
```

### 4. **POST /billing/activate-free-tier/**
Activates free tier for users with ≤3 devices.

**Response:**
```json
{
  "status": "success",
  "message": "Free tier activated"
}
```

### 5. **GET /billing/invoices/**
Returns paginated list of invoices from Stripe.

**Response:**
```json
{
  "results": [
    {
      "id": "in_xxxxx",
      "created": 1706227200,
      "status": "paid",
      "amount_paid": 80, // in cents
      "currency": "gbp",
      "period_start": 1703635200,
      "period_end": 1706227200,
      "download_url": "/billing/invoices/in_xxxxx/download/"
    }
  ]
}
```

**Backend Implementation:**
```python
invoices = stripe.Invoice.list(
    customer=customer_id,
    limit=10
)
```

### 6. **GET /billing/invoices/{invoice_id}/download/**
Returns the invoice PDF download URL.

**Response:**
```json
{
  "download_url": "https://stripe.com/invoice/download/xxxxx"
}
```

### 7. **POST /billing/create-portal-session/**
Creates Stripe Customer Portal session for self-service.

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/xxxxx"
}
```

**Backend Implementation:**
```python
session = stripe.billing_portal.Session.create(
    customer=customer_id,
    return_url='https://yourapp.com/profile'
)
```

### 8. **POST /billing/create-setup-intent/**
Creates a SetupIntent for adding payment methods (used by CustomerSheet).

**Request:**
```json
{
  "customer_id": "cus_xxxxx"
}
```

**Response:**
```json
{
  "setup_intent_client_secret": "seti_xxxxx_secret_xxxxx",
  "customer_id": "cus_xxxxx"
}
```

**Backend Implementation:**
```python
setup_intent = stripe.SetupIntent.create(
    customer=customer_id,
    payment_method_types=['card', 'us_bank_account'],
    usage='off_session'  # For future payments
)
```

### 8a. **POST /billing/customer-ephemeral-key/**
Creates an ephemeral key for CustomerSheet (required for secure client-side operations).

**Request:**
```json
{
  "customer_id": "cus_xxxxx"
}
```

**Response:**
```json
{
  "ephemeral_key_secret": "ek_xxxxx",
  "customer_email": "user@example.com"
}
```

**Backend Implementation:**
```python
# Create ephemeral key with specific API version
ephemeral_key = stripe.EphemeralKey.create(
    customer=customer_id,
    stripe_version='2023-10-16'  # Must match SDK version
)

# Get customer email for pre-fill
customer = stripe.Customer.retrieve(customer_id)
```

### 9. **POST /billing/set-default-payment-method/**
Sets a payment method as the default for the customer.

**Request:**
```json
{
  "payment_method_id": "pm_xxxxx",
  "customer_id": "cus_xxxxx"
}
```

**Backend Implementation:**
```python
# Update customer's default payment method
stripe.Customer.modify(
    customer_id,
    invoice_settings={
        'default_payment_method': payment_method_id
    }
)
```

### 10. **POST /billing/attach-payment-method/**
Attaches a payment method to customer (optional - only needed if using CardField directly).

**Request:**
```json
{
  "payment_method_id": "pm_xxxxx",
  "customer_id": "cus_xxxxx"
}
```

### 10. **POST /billing/change-plan/**
Changes subscription plan between monthly/annual.

**Request:**
```json
{
  "new_plan": "annual"
}
```

### 11. **POST /billing/cancel-subscription/**
Cancels the subscription at period end.

## Stripe Webhook Endpoints

### **POST /stripe/webhook/**
Handles Stripe webhook events.

**Important Events to Handle:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.updated`

**Backend Implementation:**
```python
@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META['HTTP_STRIPE_SIGNATURE']
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
        return HttpResponse(status=400)
    
    # Handle events
    if event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        # Update your database with subscription status
        
    return HttpResponse(status=200)
```

## Permissions & Security

### 1. **Billing Access Control**
Only **admin** and **owner** roles should access billing endpoints:

```python
def require_billing_access(view_func):
    def wrapped_view(request, *args, **kwargs):
        if request.user.role not in ['admin', 'owner']:
            return JsonResponse({'error': 'Unauthorized'}, status=403)
        return view_func(request, *args, **kwargs)
    return wrapped_view
```

### 2. **User-Device Relationship**
Track device count per organization:

```python
def get_device_counts(organization):
    total_devices = Device.objects.filter(
        organization=organization
    ).count()
    
    active_devices = Device.objects.filter(
        organization=organization,
        is_active=True
    ).count()
    
    billable_devices = max(0, total_devices - 3)
    
    return {
        'total': total_devices,
        'active': active_devices,
        'inactive': total_devices - active_devices,
        'free_quota': 3,
        'billable': billable_devices
    }
```

## Stripe Product Setup

### 1. **Create Products in Stripe Dashboard**

**Product**: WrapBattz Device Management
- **Monthly Price**: £0.40 per device
- **Annual Price**: £0.25 per device

### 2. **Price IDs**
```python
STRIPE_PRICES = {
    'monthly': 'price_xxxxx',  # Your monthly price ID
    'annual': 'price_xxxxx'    # Your annual price ID
}
```

### 3. **Customer Portal Configuration**
In Stripe Dashboard → Customer Portal:
- Enable customers to update payment methods
- Enable customers to view invoices
- Enable customers to cancel subscriptions
- Set cancellation policy (end of period)

## Testing

### Test Cards
- **Success**: 4242 4242 4242 4242
- **Requires Auth**: 4000 0025 0000 3155
- **Declined**: 4000 0000 0000 9995

### Test Webhook Locally
```bash
stripe listen --forward-to localhost:8000/stripe/webhook/
```

## Error Handling

All endpoints should return consistent error responses:
```json
{
  "error": "Error message",
  "detail": "Detailed error description",
  "code": "ERROR_CODE"
}
```

## Implementation Checklist

- [ ] Create Stripe products and prices
- [ ] Implement customer creation/retrieval
- [ ] Implement subscription endpoints
- [ ] Set up webhook handling
- [ ] Add permission checks for admin/owner
- [ ] Track device counts per organization
- [ ] Configure Customer Portal
- [ ] Test payment flows
- [ ] Handle edge cases (failed payments, etc.)