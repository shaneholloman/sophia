import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  constructor(private http: HttpClient) {
    this.profileForm = new FormGroup({
      id: new FormControl(''),
      email: new FormControl(''),
      enabled: new FormControl(false),
      hilBudget: new FormControl(0),
      hilCount: new FormControl(0),
      llmConfig: new FormGroup({
        anthropicKey: new FormControl(''),
        openaiKey: new FormControl(''),
        groqKey: new FormControl(''),
        togetheraiKey: new FormControl('')
      }),
      gitlabConfig: new FormGroup({
        host: new FormControl(''),
        token: new FormControl(''),
        topLevelGroups: new FormControl('')
      }),
      jiraConfig: new FormGroup({
        baseUrl: new FormControl(''),
        email: new FormControl(''),
        token: new FormControl('')
      }),
      perplexityKey: new FormControl(''),
      // Initialize form controls for githubConfig
    });
  }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  private loadUserProfile(): void {
    const profileUrl = `${environment.apiUrl}/profile/view`;
    this.http.get(profileUrl).subscribe((user: any) => {
      this.profileForm.patchValue(user);
    }, error => {
      console.error('Failed to load user profile', error);
    });
  }

}