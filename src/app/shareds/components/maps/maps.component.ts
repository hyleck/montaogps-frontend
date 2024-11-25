import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-maps',
  templateUrl: './maps.component.html',
  styleUrls: ['./maps.component.css']
})
export class MapsComponent  {
  // map!: google.maps.Map;

  // ngOnInit(): void {
  //   this.loadGoogleMapsScript().then(() => {
  //     this.initializeMap();
  //   });
  // }

  // private loadGoogleMapsScript(): Promise<void> {
  //   return new Promise((resolve, reject) => {
  //     if (typeof google !== 'undefined' && google.maps) {
  //       resolve();
  //       return;
  //     }
  //     const script = document.createElement('script');
  //     script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY`;
  //     script.async = true;
  //     script.defer = true;
  //     script.onload = () => resolve();
  //     script.onerror = (error) => reject(error);
  //     document.head.appendChild(script);
  //   });
  // }

  // private initializeMap(): void {
  //   const mapElement = document.getElementById('map') as HTMLElement;

  //   this.map = new google.maps.Map(mapElement, {
  //     center: { lat: 19.4326, lng: -99.1332 },
  //     zoom: 12
  //   });
  // }
}
