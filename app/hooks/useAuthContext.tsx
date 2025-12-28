// app/lib/useLicense.ts
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export function useLicense() {
  const [licenseId, setLicenseId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Busca no documento do usuário qual a licença dele (igual ao Flutter)
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setLicenseId(userDoc.data().licenseId);
          // Opcional: buscar cargo se necessário
        } else {
          // Se não houver documento em /users, assume que ele é o dono (Gerente)
          setLicenseId(user.uid);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { licenseId, loading, userId: auth.currentUser?.uid };
}