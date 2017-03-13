angular
  .module('walletApp')
  .controller('CoinifySellController', CoinifySellController);

function CoinifySellController ($scope, $filter, $q, MyWallet, Wallet, MyWalletHelpers, Alerts, currency, $uibModalInstance, trade, buySellOptions, $timeout, $interval, formatTrade, buySell, $rootScope, $cookies, $window, country, accounts) {
  $scope.fields = {};
  $scope.settings = Wallet.settings;
  $scope.btcCurrency = $scope.settings.btcCurrency;
  $scope.currencies = currency.coinifyCurrencies;
  $scope.user = Wallet.user;
  $scope.trades = buySell.trades;
  $scope.alerts = [];
  $scope.status = {};
  $scope.trade = trade;
  $scope.quote = buySellOptions.quote;
  $scope.isSell = buySellOptions.sell;
  $scope.sepaCountries = country.sepaCountryCodes;
  $scope.acceptTermsForm;
  $scope.transaction = {};
  $scope.step;
  // $scope.accounts = accounts;
  // console.log('scope.accounts', $scope.accounts)

  $scope.bankAccount = {
    account: {
      currency: null
    },
    bank: {
      name: null,
      address: {
        country: null,
        street: null, // not required
        city: null, // not required
        zipcode: null // not required
      }
    },
    holder: {
      name: null,
      address: {
        country: null,
        street: null,
        city: null,
        zipcode: null,
        state: null
      }
    }
  };

  $scope.transaction = {
    btc: $scope.trade.btc,
    fiat: $scope.trade.fiat,
    currency: null,
    fee: {
      fiat: ($scope.trade.fiat - ($scope.trade.fiat / 1.02)).toFixed(2),
      btc: ($scope.trade.btc - ($scope.trade.btc / 1.02)).toFixed(8)
    },
    creditOwed: () => {
      return ($scope.transaction.fiat - $scope.transaction.fee.fiat).toFixed(2);
    }
  };

  console.log('coinifySell $scope', $scope)

  $scope.creditOwed = () => {
    return $scope.transaction.fiat - $scope.transaction.fee.fiat;
  };

  let exchange = buySell.getExchange();
  $scope.exchange = exchange && exchange.profile ? exchange : {profile: {}};

  $scope.isKYC = $scope.trade && $scope.trade.constructor.name === 'CoinifyKYC';
  // $scope.needsKyc = () => +$scope.exchange.profile.level.name < 2;
  $scope.needsKyc = () => false;
  // $scope.needsISX = () => $scope.trade && !$scope.trade.bankAccount && buySell.tradeStateIn(buySell.states.pending)($scope.trade) || $scope.isKYC;
  $scope.needsISX = () => false;
  $scope.needsReview = () => $scope.trade && buySell.tradeStateIn(buySell.states.pending)($scope.trade);

  $scope.steps = {
    'accept-terms': 0,
    // 'isx': 1,
    'account-info': 1,
    'account-holder': 2,
    'summary': 3,
    'bank-link': 4,
    'trade-formatted': 5,
    'isx': 6
  };

  $scope.onStep = (...steps) => steps.some(s => $scope.step === $scope.steps[s]);
  $scope.afterStep = (step) => $scope.step > $scope.steps[step];
  $scope.beforeStep = (step) => $scope.step < $scope.steps[step];
  $scope.currentStep = () => Object.keys($scope.steps).filter($scope.onStep)[0];

  $scope.goTo = (step) => $scope.step = $scope.steps[step];

  $scope.nextStep = () => {
    console.log('running nextStep function')
    if (!$scope.exchange.user || !$scope.user.isEmailVerified) {
      $scope.goTo('accept-terms');
    } else if (!$scope.bankAccounts) {
      $scope.goTo('account-info');
    } else if ($scope.bankAccounts) {
      $scope.goTo('bank-link');
    } else {
      $scope.goTo('summary');
    }
  };

  $scope.isDisabled = () => {
    const bank = $scope.bankAccount;
    if ($scope.onStep('accept-terms')) {
      return !$scope.fields.acceptTOS;
    } else if ($scope.onStep('account-info')) {
      return (!bank.account.number || !bank.account.bic || !bank.bank.name || !bank.bank.address.country);
    } else if ($scope.onStep('account-holder')) {
      return (!bank.holder.name || !bank.holder.address.street || !bank.holder.address.zipcode || !bank.holder.address.city || !bank.holder.address.country)
      return false;
      // return $scope.accountInfoForm.$valid;
    } else if ($scope.onStep('select-payment-medium')) {
      return !$scope.quote || !$scope.medium;
    } else if ($scope.onStep('summary')) {
      return true;
      // return $scope.editAmount || !$scope.limits.max;
    }
  };

  $scope.setCurrency = () => {
    if ($scope.trade.quote._baseCurrency === 'BTC') {
      $scope.transaction.currency = $scope.trade.quote._quoteCurrency;
    } else {
      $scope.transaction.currency = $scope.trade.quote._baseCurrency;
    }
  };

  $scope.createBankAccount = () => {
    $scope.status.waiting = true;
    $scope.setCurrency();
    $scope.bankAccount.account.currency = $scope.transaction.currency;
    console.log('from createBankAccount', $scope.bankAccount)

    $q.resolve(buySell.createBankAccount($scope.bankAccount))
      .then((result) => {
        console.log('result of creating bank account', result)
        return result;
      })
      .then(data => {
        $scope.status.waiting = false;
        $scope.goTo('summary')
      })
      .catch(err => {
        console.log('err', err)
      })
  }

  $scope.getBankAccounts = () => {
    $q.resolve(buySell.getBankAccounts())
      .then((result) => {
        if (result) {
          $scope.registeredBankAccount = true;
          $scope.bankAccounts = result;
          console.log('scope.bankAccounts set to', result)
          return result;
        } else {
          $scope.registeredBankAccount = false;
          // load fake account
          $scope.bankAccounts = [{
            "id": 12345, // Identifier of the bank account
            "account": {
              "type": "danish", // Type of bank account
              "currency": "DKK", // Currency of the bank account
              "bic": "6456", // Account bic/swift/reg number depending on the type
              "number": "12345435345345" // Account number
            },
            "bank": {
              "name": "Bank of Coinify",
              "address": { // Address of the bank
                "country": "DK"
              }
            },
            "holder": {
              "name": "John Doe", // Name of the account holder
              "address": { // Address of the account holder
                "street": "123 Example Street",
                "zipcode": "12345",
                "city": "Exampleville",
                "state": "CA",
                "country": "US"
              }
            },
            "update_time": "2016-04-01T12:27:36Z",
            "create_time": "2016-04-01T12:23:19Z"
          }]
        }
      })
  };

  console.log('step', $scope, $scope.step)

  $scope.goToOrderHistory = () => {
    if ($scope.onStep('accept-terms') || $scope.onStep('trade-formatted') || !$scope.trades.pending.length || $state.params.selectedTab === 'ORDER_HISTORY') {
      $uibModalInstance.dismiss('');
    } else {
      $state.go('wallet.common.buy-sell.coinify', {selectedTab: 'ORDER_HISTORY'});
    }
  };

  $scope.cancel = () => {
    console.log('cancel called')
    $rootScope.$broadcast('fetchExchangeProfile');
    $uibModalInstance.dismiss('');
    $scope.trade = null;
    buySell.getTrades().then(() => {
      $scope.goToOrderHistory();
    });
  };

  $scope.close = () => {
    $scope.cancel();
  };

  $scope.determineStep = () => {
    if (!$scope.exchange.user) {
      $scope.goTo('accept-terms');
    }
  };

  // buySell.getBankAccounts().then((result) => {
  //   console.log('have result')
  //   $scope.nextStep();
  // })

  console.log('calling nextStep()')
  
  $scope.nextStep();

  $scope.setCurrency();
  // $scope.nextStep();

//   $scope.buySellDebug = $rootScope.buySellDebug;
//
//   let accountIndex = $scope.trade && $scope.trade.accountIndex ? $scope.trade.accountIndex : MyWallet.wallet.hdwallet.defaultAccount.index;
//   $scope.label = MyWallet.wallet.hdwallet.accounts[accountIndex].label;
//
//   let exchange = buySell.getExchange();
//   $scope.exchange = exchange && exchange.profile ? exchange : {profile: {}};

//   $scope.isPendingBankTransfer = () => $scope.medium === 'bank' && $scope.trade && $scope.trade.state === 'awaiting_transfer_in';
//   $scope.hideBuySteps = () => $scope.trades.completed.length >= 1;
//
//   $scope.expiredQuote = $scope.trade && new Date() > $scope.trade.quoteExpireTime && $scope.trade.id;
//   let updateBTCExpected = (quote) => { $scope.status.gettingQuote = false; $scope.btcExpected = quote; };
//
//   let eventualError = (message) => Promise.reject.bind(Promise, { message });
//
//   $scope.formattedTrade = undefined;
//   $scope.bitcoinReceived = buySellOptions.bitcoinReceived && $scope.trade && $scope.trade.bitcoinReceived;
//
//   $scope.fields = { email: $scope.user.email };
//
//   $scope.transaction = trade == null
//     ? ({ fiat: buySellOptions.fiat, btc: buySellOptions.btc, fee: 0, total: 0, currency: buySellOptions.currency || buySell.getCurrency() })
//     : ({ fiat: $scope.trade.inAmount / 100, btc: 0, fee: 0, total: 0, currency: buySell.getCurrency($scope.trade) });
//
//   $scope.changeCurrencySymbol = (curr) => { $scope.currencySymbol = currency.conversions[curr.code]; };
//   $scope.changeCurrencySymbol($scope.transaction.currency);
//
//   $timeout(() => !$scope.isKYC && $scope.changeCurrency($scope.transaction.currency));
//   $timeout(() => $scope.rendered = true, $scope.bitcoinReceived ? 0 : 4000);
//
//   $scope.hideQuote = () => (
//     $scope.afterStep('isx') ||
//     $scope.isMedium('bank') ||
//     $scope.expiredQuote || ($scope.quote && !$scope.quote.id && !$scope.trade)
//   );
//
//   $scope.userHasExchangeAcct = $scope.exchange.user;
//
//   $scope.getAccounts = () => {
//     if (!$scope.exchange.user) { return; }
//
//     let success = (accounts) => {
//       $scope.accounts = accounts;
//     };
//
//     let accountsError = eventualError('ERROR_ACCOUNTS_FETCH');
//     return $scope.mediums[$scope.medium].getAccounts().then(success, accountsError);
//   };
//
//   $scope.getPaymentMediums = () => {
//     if (!$scope.exchange.user) { return; }
//
//     // reset buySellOptions
//     buySellOptions = {};
//
//     $scope.status.waiting = true;
//
//     let success = (mediums) => {
//       $scope.mediums = mediums;
//       $scope.status.waiting = false;
//       $scope.medium && $scope.updateAmounts();
//     };
//
//     let mediumsError = eventualError('ERROR_PAYMENT_MEDIUMS_FETCH');
//     return $scope.quote.getPaymentMediums().then(success, mediumsError);
//   };
//
//   $scope.changeCurrency = (curr) => {
//     if (!curr) curr = buySell.getCurrency();
//     if ($scope.trade && !$scope.isKYC) curr = {code: $scope.trade.inCurrency};
//     $scope.transaction.currency = curr;
//     $scope.changeCurrencySymbol(curr);
//     $scope.getQuote();
//   };
//
//   $scope.standardError = (err) => {
//     console.log(err);
//     $scope.status = {};
//     try {
//       let e = JSON.parse(err);
//       let msg = e.error.toUpperCase();
//       if (msg === 'EMAIL_ADDRESS_IN_USE') $scope.rejectedEmail = true;
//       else Alerts.displayError(msg, true, $scope.alerts, {user: $scope.exchange.user});
//     } catch (e) {
//       let msg = e.error || err.message;
//       if (msg) Alerts.displayError(msg, true, $scope.alerts);
//       else Alerts.displayError('INVALID_REQUEST', true, $scope.alerts);
//     }
//   };
//
//   $scope.updateAmounts = () => {
//     if (!$scope.trade && (!$scope.quote || !$scope.exchange.user)) return;
//
//     if ($scope.quote) {
//       $scope.transaction.methodFee = ($scope.quote.paymentMediums[$scope.medium].fee / 100).toFixed(2);
//       $scope.transaction.total = ($scope.quote.paymentMediums[$scope.medium].total / 100).toFixed(2);
//     } else if ($scope.trade) {
//       $scope.transaction.total = ($scope.trade.sendAmount / 100).toFixed(2);
//     }
//   };
//
//   $scope.getQuote = () => {
//     if ($scope.trade) { $scope.updateAmounts(); return; }
//     if (buySellOptions.quote) { $scope.getPaymentMediums(); return; }
//
//     $scope.quote = null;
//     $scope.status.waiting = true;
//     $scope.status.gettingQuote = true;
//
//     let quoteError = eventualError('ERROR_QUOTE_FETCH');
//     let baseCurr = buySellOptions.btc ? 'BTC' : $scope.transaction.currency.code;
//     let quoteCurr = buySellOptions.btc ? $scope.transaction.currency.code : 'BTC';
//     let amount = buySellOptions.btc ? -Math.round($scope.transaction.btc * 100000000) : Math.round($scope.transaction.fiat * 100);
//
//     const success = (quote) => {
//       $scope.status = {};
//       $scope.expiredQuote = false;
//       $scope.quote = quote;
//       Alerts.clear($scope.alerts);
//       if (quote.baseCurrency === 'BTC') {
//         $scope.transaction.btc = quote.baseAmount / 100000000;
//         $scope.transaction.fiat = -quote.quoteAmount / 100;
//       } else {
//         $scope.transaction.fiat = -quote.baseAmount / 100;
//         $scope.transaction.btc = quote.quoteAmount / 100000000;
//       }
//     };
//
//     return buySell.getExchange().getBuyQuote(amount, baseCurr, quoteCurr)
//       .then(success, quoteError)
//       .then($scope.getPaymentMediums)
//       .then($scope.getAccounts)
//       .catch($scope.standardError);
//   };
//
//   $scope.isCurrencySelected = (currency) => currency === $scope.transaction.currency;
//
//   $scope.nextStep = () => {
//     if (!$scope.trade) {
//       if ((!$scope.user.isEmailVerified || $scope.rejectedEmail) && !$scope.exchange.user) {
//         $scope.goTo('email');
//       } else if (!$scope.exchange.user) {
//         $scope.goTo('accept-terms');
//       } else if (!$scope.isMediumSelected) {
//         $scope.goTo('select-payment-medium');
//         $scope.isMediumSelected = true;
//       } else {
//         $scope.goTo('summary');
//       }
//     } else {
//       if ($scope.needsISX() && !$scope.formattedTrade) {
//         $scope.goTo('isx');
//       } else if ($scope.needsReview()) {
//         $scope.goTo('trade-in-review');
//       } else {
//         $scope.goTo('trade-formatted');
//       }
//     }
//   };
//
//   $scope.isDisabled = () => {
//     if ($scope.onStep('email')) {
//       return !$scope.user.isEmailVerified;
//     } else if ($scope.onStep('accept-terms')) {
//       return !$scope.signupForm.$valid;
//     } else if ($scope.onStep('select-payment-medium')) {
//       return !$scope.quote || !$scope.medium;
//     } else if ($scope.onStep('summary')) {
//       if ($scope.isMedium('bank') && !$scope.rateForm.$valid) {
//         return true;
//       }
//       return $scope.editAmount || !$scope.limits.max;
//     }
//   };
//
//   // TODO figure this out - commented bc throwing error
//   // $scope.watchAddress = () => {
//   //   if ($rootScope.buySellDebug) {
//   //     console.log('$scope.watchAddress() for', $scope.trade);
//   //   }
//   //   if (!$scope.trade || $scope.bitcoinReceived || $scope.isKYC) return;
//   //   const success = () => $timeout(() => $scope.bitcoinReceived = true);
//   //   $scope.trade.watchAddress().then(success);
//   // };
//
//   $scope.formatTrade = (state) => {
//     $scope.formattedTrade = formatTrade[state]($scope.trade);
//
//     if ($scope.needsKyc()) {
//       let poll = buySell.pollUserLevel(buySell.kycs[0]);
//       $scope.$on('$destroy', poll.cancel);
//       return poll.result.then($scope.buy);
//     }
//   };
//
//   if ($scope.trade && !$scope.needsISX()) {
//     let state = $scope.trade.state;
//     // TODO
//     // if (!$scope.bitcoinReceived) $scope.watchAddress();
//     if ($scope.trade.bankAccount && $scope.trade.state === 'awaiting_transfer_in') state = 'bank_transfer';
//
//     $scope.formattedTrade = formatTrade[state]($scope.trade);
//   }
//
//   $scope.onResize = (step) => $scope.isxStep = step;
//
//   $scope.cancel = () => {
//     $rootScope.$broadcast('fetchExchangeProfile');
//     $uibModalInstance.dismiss('');
//     $scope.trade = null;
//   };
//
//   $scope.close = () => {
//     let text, action, link, index;
//     let surveyOpened = $cookies.getObject('survey-opened');
//
//     if (!$scope.exchange.user) index = 0;
//     else if (!$scope.trades.length && !$scope.trade) index = 1;
//     else index = 2;
//
//     link = links[index];
//
//     let hasSeenPrompt = surveyOpened && surveyOpened.index >= index;
//
//     if (hasSeenPrompt) {
//       [text, action] = ['CONFIRM_CLOSE_BUY', 'IM_DONE'];
//       Alerts.confirm(text, {action: action}).then($scope.cancel);
//     } else {
//       [text, action] = ['COINIFY_SURVEY', 'TAKE_SURVEY'];
//       let openSurvey = () => {
//         $scope.cancel();
//         $rootScope.safeWindowOpen(link);
//         $cookies.putObject('survey-opened', {index: index});
//       };
//       Alerts.confirm(text, {action: action, friendly: true, cancel: 'NO_THANKS'}).then(openSurvey, $scope.cancel);
//     }
//   };
//
//   $scope.getQuoteHelper = () => {
//     if ($scope.quote && !$scope.expiredQuote && $scope.beforeStep('trade-formatted')) return 'AUTO_REFRESH';
//     else if ($scope.quote && !$scope.quote.id) return 'EST_QUOTE_1';
//     else if ($scope.expiredQuote) return 'EST_QUOTE_2';
//     else return 'RATE_WILL_EXPIRE';
//   };
//
//   $scope.fakeBankTransfer = () => $scope.trade.fakeBankTransfer().then(() => {
//     $scope.formatTrade('processing');
//     $scope.$digest();
//   });
//
//   $scope.$watch('medium', (newVal) => newVal && $scope.getAccounts().then($scope.updateAmounts));
//   $scope.$watchGroup(['exchange.user', 'paymentInfo', 'formattedTrade'], $scope.nextStep);
//   $scope.$watch('user.isEmailVerified', () => $scope.onStep('email') && $scope.nextStep());
//   $scope.$watch('bitcoinReceived', (newVal) => newVal && ($scope.formattedTrade = formatTrade['success']($scope.trade)));
//
//   $scope.$watch('expiredQuote', (newVal) => {
//     if (newVal && !$scope.isKYC) {
//       $scope.status.gettingQuote = true;
//       if (!$scope.trade) $scope.getQuote();
//       else $scope.trade.btcExpected().then(updateBTCExpected);
//     }
//   });
}