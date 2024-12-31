/// <reference types="@types/google.maps" />

declare interface Window {
  google: {
    maps: typeof google.maps;
  };
}

declare module '@googlemaps/js-api-loader';
