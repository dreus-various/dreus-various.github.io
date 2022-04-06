import {Component, OnInit} from "@angular/core";

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['/auth.component.css']
})
export class AuthComponent implements OnInit {

  public ngOnInit(): void {
    window.location.href = this.getRedirectToSpotifyLoginUrl();
  }

  public getRedirectToSpotifyLoginUrl(): string {
    // return 'https://accounts.spotify.com/authorize?response_type=code&client_id=1e72c0f53ed2437e8d9a0ff6a7492811&scope=user-read-private playlist-modify-private playlist-read-collaborative playlist-read-private playlist-modify-public user-library-read&redirect_uri=http://localhost:4200/token'
    return 'https://accounts.spotify.com/authorize?response_type=code&client_id=1e72c0f53ed2437e8d9a0ff6a7492811&scope=user-read-private playlist-modify-private playlist-read-collaborative playlist-read-private playlist-modify-public user-library-read&redirect_uri=https://dreus-various.github.io/token'
  }
}
