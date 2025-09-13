export interface GoongPlacePrediction {
    description: string;
    place_id: string;
    structured_formatting: {
      main_text: string;
      secondary_text: string;
    };
  }
  
  export interface GoongApiResponse {
    status: string;
    predictions: GoongPlacePrediction[];
    error_message?: string;
  }