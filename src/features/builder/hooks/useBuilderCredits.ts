import { useState, useEffect } from 'react';
import { logger } from '../../../utils/logger';
import { getUserCredit } from '../../../services/credit/creditService';

export function useBuilderCredits(authUserId: string | undefined) {
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [isTrial, setIsTrial] = useState<boolean>(true);
  const [creditError, setCreditError] = useState<{ balance: number; needed: number } | null>(null);

  useEffect(() => {
    if (!authUserId) return;
    const loadCredits = async () => {
      try {
        const credit = await getUserCredit(authUserId);
        if (credit) {
          setUserCredits(credit.balance);
          setIsTrial(credit.totalPurchased === 0);
        }
      } catch (err) {
        logger.error('[Builder] Failed to fetch credits:', err);
      }
    };
    loadCredits();
    
    globalThis.addEventListener('focus', loadCredits);
    return () => globalThis.removeEventListener('focus', loadCredits);
  }, [authUserId]);

  return {
    userCredits,
    setUserCredits,
    isTrial,
    setIsTrial,
    creditError,
    setCreditError,
  };
}
