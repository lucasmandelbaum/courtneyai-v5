# CourtneyAI Database Schema

## Overview
This schema represents the data structure for the CourtneyAI application, a platform for managing products and generating marketing assets like scripts and video reels.

## Tables

### users
| Column       | Type      | Description                       |
|--------------|-----------|-----------------------------------|
| id           | uuid      | Primary key                       |
| email        | text      | User's email address              |
| password     | text      | Hashed password                   |
| created_at   | timestamp | When the user was created         |
| updated_at   | timestamp | When the user was last updated    |

### products
| Column       | Type      | Description                       |
|--------------|-----------|-----------------------------------|
| id           | uuid      | Primary key                       |
| user_id      | uuid      | Foreign key to users.id           |
| name         | text      | Product name                      |
| description  | text      | Product description               |
| created_at   | timestamp | When the product was created      |
| updated_at   | timestamp | When the product was last updated |

### photos
| Column       | Type      | Description                       |
|--------------|-----------|-----------------------------------|
| id           | uuid      | Primary key                       |
| product_id   | uuid      | Foreign key to products.id        |
| file_path    | text      | Path to the photo in storage      |
| file_name    | text      | Original filename                 |
| created_at   | timestamp | When the photo was uploaded       |

### videos
| Column       | Type      | Description                       |
|--------------|-----------|-----------------------------------|
| id           | uuid      | Primary key                       |
| product_id   | uuid      | Foreign key to products.id        |
| file_path    | text      | Path to the video in storage      |
| file_name    | text      | Original filename                 |
| duration     | integer   | Duration in seconds               |
| thumbnail    | text      | Path to video thumbnail           |
| created_at   | timestamp | When the video was uploaded       |

### scripts
| Column       | Type      | Description                       |
|--------------|-----------|-----------------------------------|
| id           | uuid      | Primary key                       |
| product_id   | uuid      | Foreign key to products.id        |
| title        | text      | Script title                      |
| content      | text      | Script content                    |
| prompt       | text      | Prompt used to generate script    |
| created_at   | timestamp | When the script was created       |

### reels
| Column         | Type      | Description                           |
|----------------|-----------|---------------------------------------|
| id             | uuid      | Primary key                           |
| product_id     | uuid      | Foreign key to products.id            |
| script_id      | uuid      | Foreign key to scripts.id             |
| template_id    | integer   | Template used for the reel            |
| title          | text      | Reel title                            |
| file_path      | text      | Path to the generated video in storage|
| duration       | integer   | Duration in seconds                   |
| created_at     | timestamp | When the reel was created             |

### reel_media
| Column       | Type      | Description                       |
|--------------|-----------|-----------------------------------|
| id           | uuid      | Primary key                       |
| reel_id      | uuid      | Foreign key to reels.id           |
| media_type   | text      | Either 'photo' or 'video'         |
| photo_id     | uuid      | Foreign key to photos.id          |
| video_id     | uuid      | Foreign key to videos.id          |
| display_order| integer   | Order in which media appears      |
| duration     | integer   | Duration to show (in seconds)     |
| created_at   | timestamp | When the entry was created        |

## Relationships

- A user can have many products
- A product can have many photos
- A product can have many videos
- A product can have many scripts
- A product can have many reels
- A reel is associated with one script
- A reel can include multiple photos and videos (through reel_media)

## Indexes

- products(user_id)
- photos(product_id)
- videos(product_id)
- scripts(product_id)
- reels(product_id, script_id)
- reel_media(reel_id)
- reel_media(photo_id) WHERE media_type = 'photo'
- reel_media(video_id) WHERE media_type = 'video'

## Potential Extensions

### templates
| Column         | Type      | Description                           |
|----------------|-----------|---------------------------------------|
| id             | integer   | Primary key                           |
| name           | text      | Template name                         |
| description    | text      | Template description                  |
| has_voiceover  | boolean   | Whether the template includes voiceover|
| has_captions   | boolean   | Whether the template includes captions|
| has_music      | boolean   | Whether the template includes music   |
| created_at     | timestamp | When the template was created         |

### analytics
| Column         | Type      | Description                           |
|----------------|-----------|---------------------------------------|
| id             | uuid      | Primary key                           |
| reel_id        | uuid      | Foreign key to reels.id               |
| views          | integer   | Number of views                       |
| shares         | integer   | Number of shares                      |
| engagement_rate| float     | Engagement rate percentage            |
| updated_at     | timestamp | When the analytics were last updated  | 