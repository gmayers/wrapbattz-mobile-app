import { CustomerSheet } from '@stripe/stripe-react-native';
import { createCustomerSheetSession, setDefaultPaymentMethod } from '../../api/endpoints/billing';

// Opens Stripe's native saved-card sheet. The card the owner picks becomes
// the default for the customer and the subscription (backend does both).
export async function manageCard(): Promise<'updated' | 'unchanged'> {
  const session = await createCustomerSheetSession();

  const init = await CustomerSheet.initialize({
    customerId: session.customer_id,
    customerEphemeralKeySecret: session.ephemeral_key_secret,
    setupIntentClientSecret: session.setup_intent_client_secret,
    merchantDisplayName: 'ToolTraq',
    returnURL: 'tooltraq://stripe-redirect',
    allowsRemovalOfLastSavedPaymentMethod: false,
  });
  if (init.error) throw new Error(init.error.message);

  const { error, paymentMethod } = await CustomerSheet.present();
  if (error) {
    if (error.code === 'Canceled') return 'unchanged';
    throw new Error(error.message);
  }
  if (!paymentMethod) return 'unchanged';

  await setDefaultPaymentMethod(paymentMethod.id);
  return 'updated';
}
