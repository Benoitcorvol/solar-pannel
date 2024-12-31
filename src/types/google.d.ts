/// <reference types="@types/google.maps" />

declare interface Window {
  google: {
    maps: typeof google.maps & {
      importLibrary(libraryName: string): Promise<google.maps.MarkerLibrary>;
    };
  };
}

declare namespace google.maps {
  interface MarkerLibrary {
    AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
    PinElement: typeof google.maps.marker.PinElement;
  }

  namespace marker {
    class AdvancedMarkerElement extends google.maps.MVCObject {
      constructor(options?: AdvancedMarkerElementOptions);
      position: google.maps.LatLng | google.maps.LatLngLiteral | null;
      title: string | null;
      map: google.maps.Map | null;
      content: Element | null;
    }

    interface AdvancedMarkerElementOptions {
      position?: google.maps.LatLng | google.maps.LatLngLiteral;
      title?: string;
      map?: google.maps.Map;
      content?: Element;
    }

    class PinElement {
      constructor(options?: PinElementOptions);
      element: Element;
      background: string;
      borderColor: string;
      glyphColor: string;
      scale: number;
    }

    interface PinElementOptions {
      background?: string;
      borderColor?: string;
      glyphColor?: string;
      scale?: number;
    }
  }
}

declare module '@googlemaps/js-api-loader';
