import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';

export interface ConfirmationOptions {
  header: string;
  message: string;
  confirmText: string;
  cancelText?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private readonly alertController = inject(AlertController);

  async confirm(options: ConfirmationOptions): Promise<boolean> {
    const alert = await this.alertController.create({
      header: options.header,
      message: options.message,
      buttons: [
        {
          text: options.cancelText ?? 'Volver',
          role: 'cancel'
        },
        {
          text: options.confirmText,
          role: 'confirm'
        }
      ]
    });

    await alert.present();
    const result = await alert.onDidDismiss();
    return result.role === 'confirm';
  }
}
