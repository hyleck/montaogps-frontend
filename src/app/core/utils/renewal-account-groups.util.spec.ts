import { groupByRenewalAccount } from './renewal-account-groups.util';

describe('groupByRenewalAccount', () => {
  it('puts the client account first, then each subaccount alphabetically, keeping the order inside', () => {
    const groups = groupByRenewalAccount([
      { id: 'a', account: { path: ['Hillary', 'Coop Hillary'] } },
      { id: 'b', account: { path: ['Hillary'] } },
      { id: 'c', account: { path: ['Hillary', 'Cobranza'] } },
      { id: 'd', account: { path: ['Hillary', 'Coop Hillary'] } },
    ]);
    expect(groups.map(group => group.path.join(' > '))).toEqual(['Hillary', 'Hillary > Cobranza', 'Hillary > Coop Hillary']);
    expect(groups[2].items.map(item => item.id)).toEqual(['a', 'd']);
  });

  it('keeps GPS without an account in one group', () => {
    expect(groupByRenewalAccount<{ id: string; account?: { path: string[] } }>([{ id: 'x' }, { id: 'y' }]).map(group => group.items.length)).toEqual([2]);
  });
});
