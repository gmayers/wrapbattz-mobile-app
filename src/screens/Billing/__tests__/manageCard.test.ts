import { CustomerSheet } from '@stripe/stripe-react-native';
import * as billing from '../../../api/endpoints/billing';
import { manageCard } from '../manageCard';

jest.mock('../../../api/endpoints/billing');
jest.mock('@stripe/stripe-react-native', () => ({
  CustomerSheet: { initialize: jest.fn(), present: jest.fn() },
}));

const session = { customer_id: 'cus_1', ephemeral_key_secret: 'ek_1', setup_intent_client_secret: 'seti_1' };

describe('manageCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (billing.createCustomerSheetSession as jest.Mock).mockResolvedValue(session);
    (CustomerSheet.initialize as jest.Mock).mockResolvedValue({});
  });

  it('initialises the sheet with the backend session', async () => {
    (CustomerSheet.present as jest.Mock).mockResolvedValue({ error: { code: 'Canceled' } });
    await manageCard();
    expect(CustomerSheet.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cus_1',
        customerEphemeralKeySecret: 'ek_1',
        setupIntentClientSecret: 'seti_1',
      }),
    );
  });

  it('saves the chosen card as the default', async () => {
    (CustomerSheet.present as jest.Mock).mockResolvedValue({ paymentMethod: { id: 'pm_9' } });
    await expect(manageCard()).resolves.toBe('updated');
    expect(billing.setDefaultPaymentMethod).toHaveBeenCalledWith('pm_9');
  });

  it('treats cancel as unchanged', async () => {
    (CustomerSheet.present as jest.Mock).mockResolvedValue({ error: { code: 'Canceled' } });
    await expect(manageCard()).resolves.toBe('unchanged');
    expect(billing.setDefaultPaymentMethod).not.toHaveBeenCalled();
  });

  it('throws on init failure', async () => {
    (CustomerSheet.initialize as jest.Mock).mockResolvedValue({ error: { message: 'bad key' } });
    await expect(manageCard()).rejects.toThrow('bad key');
  });

  it('throws on sheet failure', async () => {
    (CustomerSheet.present as jest.Mock).mockResolvedValue({ error: { code: 'Failed', message: 'declined' } });
    await expect(manageCard()).rejects.toThrow('declined');
  });
});
