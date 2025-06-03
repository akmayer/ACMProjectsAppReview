// src/pages/Home.tsx
import { useEffect, useState } from 'react';
import { gapi } from 'gapi-script';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

export default function Home() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [gapiReady, setGapiReady] = useState(false)
  const [userName, setUserName] = useState('');
  const [, setUpdateTime] = useState(0);

  // Force refresh every second when not signed in
  useEffect(() => {
    if (!isSignedIn) {
      const interval = setInterval(() => {
        setUpdateTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isSignedIn]);

  useEffect(() => {
    gapi.load('client:auth2', () => {
      gapi.client.init({
        clientId: CLIENT_ID,
        scope: SCOPES,
      }).then(() => {
        const auth = gapi.auth2.getAuthInstance();
  
        const handleUserChange = () => {
          const user = auth.currentUser.get();
          if (user && user.isSignedIn()) {
            const profile = user.getBasicProfile();
            setUserName(profile?.getName() || '');
          }
        };
  
        setIsSignedIn(auth.isSignedIn.get());
        if (auth.isSignedIn.get()) handleUserChange();
  
        auth.isSignedIn.listen((signedIn: boolean) => {
          setIsSignedIn(signedIn);
          if (signedIn) {
            handleUserChange();
          } else {
            setUserName('');
          }
        });
  
        setGapiReady(true);
      });
    });
  }, []);

  const signIn = () => {
    if (!gapiReady) {
      console.warn("Google API not ready yet.");
      return;
    }
  
    gapi.auth2.getAuthInstance().signIn({
      prompt: 'select_account'
    });
  };

  const signOut = () => {
    gapi.auth2.getAuthInstance().signOut();
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      {isSignedIn ? (
        <div className="text-center flex flex-col items-center">
          <h1 className="text-2xl font-bold mb-4">Signed in for review as: {userName}</h1>
          <div className="space-x-4 flex justify-center">
            <button onClick={signOut} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">Sign Out</button>
            <a href="/review" className="inline-block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">Review All Applicants</a>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 px-4 py-8">
              <a href="/review?name=AI" className="px-4 py-2 bg-green-500 text-white rounded hover:bg-purple-600 transition-colors">Review AI First Priority</a>
              <a href="/review?name=Design" className="px-4 py-2 bg-green-500 text-white rounded hover:bg-purple-600 transition-colors">Review Design First Priority</a>
              <a href="/review?name=Hack" className="px-4 py-2 bg-green-500 text-white rounded hover:bg-purple-600 transition-colors">Review Hack First Priority</a> 
              <a href="/review?name=Game%20Dev" className="px-4 py-2 bg-green-500 text-white rounded hover:bg-purple-600 transition-colors">Review Game Dev First Priority</a>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center flex flex-col items-center">
          <h1 className="text-2xl font-bold mb-4">Sign In With Your ACMUCSD Email For Access</h1>
          <button onClick={signIn} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">Sign In</button>
        </div>
      )}
    </div>
  );
}
