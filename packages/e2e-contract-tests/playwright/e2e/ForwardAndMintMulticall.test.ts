import { getButtonByText, hasText } from '@fuels/playwright-utils';
import type { FuelWalletTestHelper } from '@fuels/playwright-utils';
import { expect } from '@playwright/test';
import { bn, toBech32 } from 'fuels';
import type { WalletUnlocked } from 'fuels';

import '../../load.envs.js';
import {
  calculateAssetId,
  getBaseAssetId,
  shortAddress,
} from '../../src/utils';
import { testSetup, transferMaxBalance } from '../utils';

import { MAIN_CONTRACT_ID } from './config';
import { test, useLocalCRX } from './test';
import {
  checkAddresses,
  checkFee,
  connect,
  waitSuccessTransaction,
} from './utils';

useLocalCRX();

test.describe('Forward and Mint Multicall', () => {
  let fuelWalletTestHelper: FuelWalletTestHelper;
  let fuelWallet: WalletUnlocked;
  let masterWallet: WalletUnlocked;

  const depositAmount = '0.010';

  test.beforeEach(async ({ context, extensionId, page }) => {
    ({ fuelWalletTestHelper, fuelWallet, masterWallet } = await testSetup({
      context,
      page,
      extensionId,
      amountToFund: bn.parseUnits(depositAmount).mul(2),
    }));
  });

  test.afterEach(async () => {
    await transferMaxBalance({
      fromWallet: fuelWallet,
      toWallet: masterWallet,
    });
  });

  test('e2e forward and mint multicall', async ({ page }) => {
    await connect(page, fuelWalletTestHelper);

    const depositHalfInput = page.getByLabel('Forward amount multicall');
    await depositHalfInput.fill(depositAmount);

    const mintAmount = '1.2345';
    const mintInput = page.getByLabel('Mint amount multicall');
    await mintInput.fill(mintAmount);

    const forwardHalfAndMintButton = getButtonByText(
      page,
      'Deposit And Mint Multicall'
    );
    await page.waitForTimeout(2500);
    await forwardHalfAndMintButton.click();

    const walletNotificationPage =
      await fuelWalletTestHelper.getWalletPopupPage();

    // test forward asset name is shown
    await hasText(walletNotificationPage, 'Ethereum');
    // test forward asset id is shown
    await hasText(walletNotificationPage, shortAddress(await getBaseAssetId()));
    // test forward eth amount is correct
    await hasText(walletNotificationPage, `${depositAmount} ETH`);

    // test mint asset name is shown
    await hasText(walletNotificationPage, 'Unknown', 0, 5000, true);
    // test mint asset id is shown
    const assetId = calculateAssetId(MAIN_CONTRACT_ID, await getBaseAssetId());
    await hasText(walletNotificationPage, shortAddress(assetId));
    // test mint amount is correct
    await hasText(walletNotificationPage, mintAmount);

    // test gas fee is shown and correct
    await hasText(walletNotificationPage, 'Fee (network)');
    // const fee = bn.parseUnits('0.000004886');
    // await checkFee(walletNotificationPage, {
    //   minFee: fee.sub(100),
    //   maxFee: fee.add(100),
    // });

    const fuelContractId = toBech32(MAIN_CONTRACT_ID);
    await checkAddresses(
      { address: fuelWallet.address.toAddress(), isContract: false },
      { address: fuelContractId, isContract: true },
      walletNotificationPage
    );
    await checkAddresses(
      { address: fuelContractId, isContract: true },
      { address: fuelWallet.address.toAddress(), isContract: false },
      walletNotificationPage
    );

    // Test approve
    const preDepositBalanceEth = await fuelWallet.getBalance();
    const preDepositBalanceTkn = await fuelWallet.getBalance(assetId);
    await fuelWalletTestHelper.walletApprove();
    await waitSuccessTransaction(page);
    const postDepositBalanceEth = await fuelWallet.getBalance();
    const postDepositBalanceTkn = await fuelWallet.getBalance(assetId);
    expect(
      Number.parseFloat(
        preDepositBalanceEth.sub(postDepositBalanceEth).format({ precision: 3 })
      )
    ).toBe(Number.parseFloat(depositAmount));
    expect(
      Number.parseFloat(
        postDepositBalanceTkn.sub(preDepositBalanceTkn).format({ precision: 4 })
      )
    ).toBe(Number.parseFloat(mintAmount));
  });
});
