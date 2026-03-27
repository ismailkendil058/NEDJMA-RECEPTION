import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function DynamicManifest() {
    const location = useLocation();

    useEffect(() => {
        let manifestUrl = '/manifest.json';
        let appleIconUrl = '/apple-touch-icon.png';
        let title = 'PasseVite';

        if (location.pathname.startsWith('/manager')) {
            manifestUrl = '/manifest-manager.json';
            appleIconUrl = '/apple-touch-icon-manager.png';
            title = 'PV Manager';
        } else if (location.pathname.startsWith('/accueil')) {
            manifestUrl = '/manifest-accueil.json';
            appleIconUrl = '/apple-touch-icon.png';
            title = 'PV Accueil';
        } else if (location.pathname.startsWith('/medecin')) {
            manifestUrl = '/manifest-medecin.json';
            appleIconUrl = '/apple-touch-icon.png';
            title = 'PV Médecin';
        }

        // Update manifest
        let manifestLink = document.querySelector('link[rel="manifest"]');
        if (manifestLink) {
            manifestLink.setAttribute('href', manifestUrl);
        } else {
            manifestLink = document.createElement('link');
            manifestLink.setAttribute('rel', 'manifest');
            manifestLink.setAttribute('href', manifestUrl);
            document.head.appendChild(manifestLink);
        }

        // Update apple-touch-icon
        let appleIconLink = document.querySelector('link[rel="apple-touch-icon"]');
        if (appleIconLink) {
            appleIconLink.setAttribute('href', appleIconUrl);
        } else {
            appleIconLink = document.createElement('link');
            appleIconLink.setAttribute('rel', 'apple-touch-icon');
            appleIconLink.setAttribute('href', appleIconUrl);
            document.head.appendChild(appleIconLink);
        }

        // Update title meta tag for iOS
        let titleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (titleMeta) {
            titleMeta.setAttribute('content', title);
        }

        // Also update document title
        document.title = title;

    }, [location.pathname]);

    return null;
}
