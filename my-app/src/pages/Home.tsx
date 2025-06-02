// src/pages/Home.tsx
import { useEffect, useState } from 'react';
import { gapi } from 'gapi-script';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';


export default function Home() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [gapiReady, setGapiReady] = useState(false)
  const [userName, setUserName] = useState('');

  useEffect(() => {
    gapi.load('client:auth2', () => {
      gapi.client.init({
        clientId: CLIENT_ID,
        scope: SCOPES,
      }).then(() => {
        const auth = gapi.auth2.getAuthInstance();
        setIsSignedIn(auth.isSignedIn.get());
        auth.isSignedIn.listen(setIsSignedIn);
        setGapiReady(true);
        const user = auth.currentUser.get();
        if (user) {
          const profile = user.getBasicProfile();
          setUserName(profile.getName());
        }
      });
    });
  }, []);

  const signIn = () => {
    if (!gapiReady) {
      console.warn("Google API not ready yet.");
      return;
    }
    gapi.auth2.getAuthInstance().signIn();
  };

  const signOut = () => {
    gapi.auth2.getAuthInstance().signOut();
  };
  
  return (
    <div>
      {isSignedIn ? (
        <div>
          <h1 className="text-2xl font-bold">Signed in for review as: {userName}</h1>
          <div className="space-x-4">
            <button onClick={signOut} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">Sign Out</button>
            <a href="/review" className="inline-block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">Continue to Review</a>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold">Sign In With Your ACMUCSD Email For Access</h1>
          <button onClick={signIn} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">Sign In</button>
        </div>
      )}
    </div>
  );
}
