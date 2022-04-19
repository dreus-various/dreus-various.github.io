import {Component, OnInit} from "@angular/core";
import {CookieService} from "ngx-cookie-service";
import {Router} from "@angular/router";
import {SpotifyService} from "./spotify.service";
import {firstValueFrom, from, map, of, Subject, switchMap} from "rxjs";

@Component({
  selector: 'main',
  templateUrl: './main.component.html',
  styleUrls: ['main.component.css']
})
export class MainComponent implements OnInit {

  private playlistName = 'Dreus radio playlist';

  public loading: boolean = false;

  constructor(private cookie: CookieService, private router: Router, private spotifyService: SpotifyService) {
  }

  public ngOnInit() {
    let spotifyToken = this.cookie.get('spotify_token');
    if (!spotifyToken) {
      this.router.navigate(['/']);
    }
    this.spotifyService.getUserInfo().subscribe(res => {
      this.spotifyService.setUserId(res.id)
    });
  }

  private getNext(offset: number, limit: number, arr: string[]): string[] {
    return arr.slice(offset, offset + limit);
  }

  public generatePlaylist() {
    this.loading = true;
    this.spotifyService.clearCache();

    this.spotifyService.getPlaylistByName(this.playlistName).pipe(
      switchMap(res => {
        if (!res) {
          return this.spotifyService.saveNewPlaylist(this.playlistName, '')
        }
        return of(res);
      }),
      switchMap(playlistId => from(this.spotifyService.deleteAllSong(playlistId))),
      switchMap(playlistId => this.spotifyService.getTotalUserTracks().pipe(
        map(total => ({total, playlistId}))
      )),
    ).subscribe(async total => {
      let currentNumberForSeed = 2;

      const currentTracks = new Set<string>();
      let currentNumber = 0;

      while (currentTracks.size <= 400 && currentNumber <= total.total * 0.2) {
        const indices = [];
        for (let i = 0; i < currentNumberForSeed; i++) {
          indices.push(this.spotifyService.getRandomNumber(0, total.total - 1));
        }

        const uris = await this.spotifyService.processTrack(indices);
        uris.forEach(uri => currentTracks.add(uri));
        currentNumber++;
        currentNumberForSeed = this.getNextNumberOfTracks(currentNumberForSeed);
      }
      let currentTracksArray = Array.from(currentTracks);
      currentTracksArray = this.shuffle(currentTracksArray);

      console.log(`Size of tracks to add ${currentTracksArray.length}`)
      let index = 0;
      const step = 100;
      let nextBatch = this.getNext(index, step, currentTracksArray);

      while (nextBatch.length !== 0) {
        await firstValueFrom(this.spotifyService.addToPlaylist(total.playlistId, nextBatch));
        index += step;
        nextBatch = this.getNext(index, step, currentTracksArray);
      }

      this.loading = false;
    });
  }

  private shuffle(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private getNextNumberOfTracks(num: number): number {
    if (num >= 4) {
      return 2;
    }
    if (num < 2) {
      return 2;
    }
    return num + 1;
  }
}
