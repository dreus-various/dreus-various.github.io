import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Params, Router} from "@angular/router";
import {HttpClient} from "@angular/common/http";
import {map, switchMap} from "rxjs";
import {CookieService} from "ngx-cookie-service";

@Component({
  selector: 'main',
  templateUrl: './token.component.html',
  styleUrls: ['./token.component.css']
})
export class TokenComponent implements OnInit {

  code: string = '';

  constructor(private router: ActivatedRoute,
              private route: Router,
              private http: HttpClient,
              private cookie: CookieService) {
  }

  public ngOnInit(): void {
    this.router.queryParams.pipe(
      map((params: Params) => params['code']),
      switchMap((code: string) => {
        const body = new URLSearchParams();
        body.set('grant_type', 'authorization_code');
        body.set('code', code);
        body.set('redirect_uri', 'https://dreus-various.github.io/token');
        // body.set('redirect_uri', 'http://localhost:4200/token');
        return this.http.post<{ access_token: string, expires_in: number }>('https://accounts.spotify.com/api/token', body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa('1e72c0f53ed2437e8d9a0ff6a7492811:20cc6a6d0cc34fc4ba4356b533c2d871')}`
          }
        })
      }),
    ).subscribe(res => {
      const date = new Date();
      date.setSeconds(date.getSeconds() + res.expires_in);
      this.cookie.set('spotify_token', res.access_token, date);

      this.route.navigate(['/main']);
    })
  }
}
