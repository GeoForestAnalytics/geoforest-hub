// app/hooks/useLicense.ts
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export function useLicense() {
  const [licenseId, setLicenseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setLicenseId(userDoc.data().licenseId);
        } else {
          setLicenseId(user.uid); // Fallback para o próprio UID se for o Gerente
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { licenseId, loading };
}